const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─────────────────────────────────────────────────────────────
//  QUOTA-AWARE AI LOAD BALANCER
//
//  Two failure categories:
//
//  QUOTA_EXHAUSTED  (429, 402, or API-specific body signals)
//    → Provider disabled until midnight UTC.
//    → Failover is INSTANTANEOUS — zero wait.
//
//  TRANSIENT_ERROR  (network, 500, timeout, parse failure)
//    → Provider enters a 60-second cool-down.
//    → Retried normally after cool-down.
// ─────────────────────────────────────────────────────────────

const TRANSIENT_COOLDOWN_MS = 60_000;
const TRANSIENT_FAIL_THRESH = 2;   // AI calls are expensive, fail faster

function msUntilMidnightUTC() {
    const now  = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return next - now;
}

function isQuotaError(err) {
    const status = err?.response?.status || err?.status;
    const body   = JSON.stringify(err?.response?.data || err?.errorDetails || '').toLowerCase();
    const msg    = (err?.message || '').toLowerCase();

    if (status === 429) return true;
    if (status === 402) return true;
    // Gemini SDK wraps quota in message text
    if (msg.includes('quota') || msg.includes('resource_exhausted') ||
        msg.includes('rate limit') || msg.includes('daily limit') ||
        msg.includes('exceeded') || msg.includes('too many requests')) return true;
    if (body.includes('quota') || body.includes('resource_exhausted') ||
        body.includes('rate_limit') || body.includes('exceeded')) return true;
    return false;
}

class AIProvider {
    constructor(name, fn) {
        this.name         = name;
        this.fn           = fn;
        this.failures     = 0;
        this.blockedUntil = 0;   // transient cool-down
        this.quotaUntil   = 0;   // quota reset (midnight UTC)
    }

    get isAvailable() {
        return Date.now() >= this.quotaUntil && Date.now() >= this.blockedUntil;
    }

    onSuccess() {
        this.failures = 0; this.blockedUntil = 0;
        console.log(`[AI-LB] ✓ ${this.name} succeeded`);
    }

    onQuotaExhausted() {
        const resetIn     = msUntilMidnightUTC();
        this.quotaUntil   = Date.now() + resetIn;
        this.failures     = 0;
        console.warn(`[AI-LB] ⛔ ${this.name} QUOTA EXHAUSTED — skipped until midnight UTC (${Math.round(resetIn / 60000)} min)`);
    }

    onTransientError(msg) {
        this.failures++;
        if (this.failures >= TRANSIENT_FAIL_THRESH) {
            this.blockedUntil = Date.now() + TRANSIENT_COOLDOWN_MS;
            this.failures     = 0;
            console.warn(`[AI-LB] ⏳ ${this.name} transient-blocked ${TRANSIENT_COOLDOWN_MS / 1000}s`);
        } else {
            console.warn(`[AI-LB] ✗ ${this.name} transient failure (${this.failures}/${TRANSIENT_FAIL_THRESH}): ${msg}`);
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  AI PROVIDER IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────

// ── Strategy 1: Google Gemini (Primary) ────────────────────
async function callGemini(prompt) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(key);

    // Try primary model first, fall back to lite variant if quota hit
    const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-8b'];
    let lastErr;
    for (const modelName of models) {
        try {
            const model  = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text   = result.response.text();
            const parsed = extractJSON(text);
            if (!parsed) throw new Error(`${modelName}: could not parse JSON`);
            console.log(`[AI-LB] Gemini model used: ${modelName}`);
            return parsed;
        } catch (e) {
            lastErr = e;
            const isQuota = e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED') || e.message?.includes('quota');
            if (!isQuota) throw e;  // non-quota error — don't retry other models
            console.warn(`[AI-LB] ${modelName} quota hit, trying next model...`);
        }
    }
    throw lastErr;  // all Gemini models exhausted → triggers Groq fallback
}

// ── Strategy 2: Groq / Llama3 (Secondary) ──────────────────
async function callGroq(prompt) {
    const key = process.env.GROQ_API_KEY;
    if (!key || key === 'your_groq_key_here') throw new Error('GROQ_API_KEY not configured');

    // Model priority list — Groq deprecates models periodically, try in order
    const models = [
        'llama-3.3-70b-versatile',     // current flagship free model
        'llama-3.1-70b-versatile',     // previous generation fallback
        'llama3-8b-8192',              // lightweight fallback
        'gemma2-9b-it',               // Google Gemma via Groq
    ];

    let lastErr;
    for (const model of models) {
        try {
            const res = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model,
                    messages: [
                        { role: 'system', content: 'You are a JSON-only responder. Always respond with valid JSON, no markdown.' },
                        { role: 'user',   content: prompt },
                    ],
                    temperature:     0.2,
                    response_format: { type: 'json_object' },
                },
                { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 20000 }
            );
            const content = res.data.choices[0].message.content;
            const parsed  = extractJSON(content);
            if (!parsed) throw new Error(`Groq ${model}: could not parse JSON`);
            console.log(`[AI-LB] Groq model used: ${model}`);
            return parsed;
        } catch (e) {
            lastErr = e;
            const isDecommissioned = e.response?.status === 400 && e.response?.data?.error?.message?.includes('decommission');
            const isNotFound       = e.response?.status === 404;
            if (isDecommissioned || isNotFound) {
                console.warn(`[AI-LB] Groq model ${model} unavailable, trying next...`);
                continue;
            }
            throw e;  // real error (auth, quota) — escalate immediately
        }
    }
    throw lastErr;
}

// ── Strategy 3: Hugging Face / Mistral (Tertiary) ──────────
async function callHuggingFace(prompt) {
    const token = process.env.HF_TOKEN;
    if (!token || token === 'your_huggingface_token_here') throw new Error('HF_TOKEN not configured');

    // Use the newer Inference API endpoint with a reliable instruction model
    const models = [
        'mistralai/Mistral-7B-Instruct-v0.3',
        'microsoft/Phi-3-mini-4k-instruct',
        'HuggingFaceH4/zephyr-7b-beta',
    ];

    let lastErr;
    for (const modelId of models) {
        try {
            const res = await axios.post(
                `https://api-inference.huggingface.co/models/${modelId}`,
                {
                    inputs: prompt,
                    parameters: { max_new_tokens: 256, return_full_text: false },
                },
                {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    timeout: 40000,
                }
            );
            // Handle both array and object responses
            const raw    = Array.isArray(res.data) ? res.data[0]?.generated_text : res.data?.generated_text;
            const text   = raw || '';
            const parsed = extractJSON(text);
            if (!parsed) throw new Error(`HuggingFace ${modelId}: could not parse JSON`);
            console.log(`[AI-LB] HuggingFace model used: ${modelId}`);
            return parsed;
        } catch (e) {
            lastErr = e;
            const status = e.response?.status;
            if (status === 503 || status === 504) {
                // Model loading — try next
                console.warn(`[AI-LB] HuggingFace ${modelId} loading (${status}), trying next model...`);
                continue;
            }
            if (status === 401 || status === 403) throw e;  // bad token — escalate
            console.warn(`[AI-LB] HuggingFace ${modelId} failed: ${e.message.slice(0, 60)}`);
        }
    }
    throw lastErr || new Error('All HuggingFace models unavailable');
}

// ── Strategy 4: OpenRouter (free models, Quaternary) ───────
// Aggregates many free models (Llama, Mistral, etc.) under one key.
// Sign up: https://openrouter.ai — free tier available.
async function callOpenRouter(prompt) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key || key === 'your_openrouter_key_here') throw new Error('OPENROUTER_API_KEY not configured');

    // Free models on OpenRouter — try in priority order (updated May 2026)
    const models = [
        'openrouter/auto',                          // OpenRouter auto-router (picks best free model)
        'meta-llama/llama-4-maverick:free',         // Meta Llama 4
        'google/gemma-4-31b:free',                  // Google Gemma 4
        'deepseek/deepseek-v4-flash:free',          // DeepSeek V4
        'nvidia/nemotron-3-super:free',             // NVIDIA Nemotron
    ];

    let lastErr;
    for (const model of models) {
        try {
            const res = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                { model, messages: [{ role: 'user', content: prompt }], max_tokens: 400 },
                {
                    headers: {
                        Authorization:  `Bearer ${key}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://apexclub-muse.netlify.app',
                        'X-Title':      'APEX Assessment Platform',
                    },
                    timeout: 25000,
                }
            );
            const text   = res.data.choices[0].message.content;
            const parsed = extractJSON(text);
            if (!parsed) throw new Error(`OpenRouter ${model}: could not parse JSON`);
            console.log(`[AI-LB] OpenRouter model used: ${model}`);
            return parsed;
        } catch (e) {
            lastErr = e;
            const status = e.response?.status;
            if (status === 404) {
                console.warn(`[AI-LB] OpenRouter model ${model} not found (404), trying next...`);
                continue;
            }
            if (status === 401 || status === 403) throw e;  // bad key — escalate
            console.warn(`[AI-LB] OpenRouter ${model} failed: ${(e.response?.data?.error?.message || e.message).slice(0, 60)}`);
        }
    }
    throw lastErr || new Error('All OpenRouter free models unavailable');
}

// ─────────────────────────────────────────────────────────────
//  PROVIDER REGISTRY
// ─────────────────────────────────────────────────────────────
const aiProviders = [
    new AIProvider('Gemini',      callGemini),
    new AIProvider('Groq',        callGroq),
    new AIProvider('HuggingFace', callHuggingFace),
    new AIProvider('OpenRouter',  callOpenRouter),
];

// ─────────────────────────────────────────────────────────────
//  MAIN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────

/**
 * Multi-Provider AI Orchestrator with quota-aware instant failover.
 * Tries each available provider in order. If a provider hits its
 * daily quota, it is INSTANTLY skipped (no waiting) and the next
 * provider is tried within milliseconds.
 */
async function analyzeCode(code, language, questionText, constraints, testResults, starterCode) {
    const prompt = buildPrompt(code, language, questionText, constraints, testResults, starterCode);

    for (const provider of aiProviders) {
        if (!provider.isAvailable) {
            const blockedReason = provider.quotaUntil > Date.now() ? 'QUOTA' : 'COOLDOWN';
            console.log(`[AI-LB] Skipping ${provider.name} (${blockedReason})`);
            continue;
        }

        try {
            console.log(`[AI-LB] Trying ${provider.name}...`);
            const result = await provider.fn(prompt);
            provider.onSuccess();
            return result;
        } catch (err) {
            if (isQuotaError(err)) {
                provider.onQuotaExhausted();   // instant — no delay
            } else {
                provider.onTransientError(err.message);
            }
            // immediately continue to next provider
        }
    }

    // All providers exhausted or quota'd — return heuristic offline analysis
    console.log('[AI-LB] All AI providers unavailable → heuristic offline fallback');
    return simulatedAIAnalysis(code, testResults);
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

function buildPrompt(code, language, questionText, constraints, testResults, starterCode) {
    return `You are an expert coding assessment AI.
Evaluate the following student code for this problem:
Problem: ${questionText}
Constraints: ${constraints}
Language: ${language}

Starter Code (Provided Template):
${starterCode || 'None provided'}

Final Student Code:
${code}

Test Case Results:
${JSON.stringify(testResults)}

Evaluate only the code logic provided by the student. Focus on how they utilized or modified the starter template.
Provide:
1. Quality: Brief qualitative assessment.
2. Complexity: Big O notation.
3. Suggestions: 1-2 actionable tips.
4. Logic Score: A number from 0-100.

Respond ONLY with a JSON object { "quality": "", "complexity": "", "suggestions": "", "logicScore": 0 }
Do not include markdown formatting or backticks.`;
}

function extractJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
    } catch (_) {}
    return null;
}

function simulatedAIAnalysis(code, testResults) {
    const passCount  = testResults.filter(r => r.isPassed).length;
    const totalCount = testResults.length;
    const score      = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

    let quality     = 'Logic is logically consistent with outputs.';
    if (score === 100) quality = 'Excellent! All edge cases satisfied.';
    else if (score > 50) quality = 'Functional logic with minor edge-case failures.';
    else quality = 'Critical logic mismatch with requirements.';

    let suggestions = 'Review nested loops and variable scopes.';
    if (code.includes('for') && code.includes('if')) suggestions = 'Ensure termination conditions are correct.';
    if (score < 100) suggestions = 'Check input boundary conditions (null/empty inputs).';

    return { quality, complexity: 'O(n) — Estimated heuristically', suggestions, logicScore: score };
}

module.exports = { analyzeCode };
