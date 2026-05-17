const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// API Keys from environment variables
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const HF_TOKEN = process.env.HF_TOKEN || '';

// Model Configs
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
const GROQ_MODEL = 'llama3-70b-8192'; // Using high performance free model

/**
 * Multi-Provider AI Orchestrator
 * Implements a cascading fallback mechanism to ensure 100% uptime
 */
async function analyzeCode(code, language, questionText, constraints, testResults, starterCode) {
    const prompt = `
    You are an expert coding assessment AI. 
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
    Do not include markdown formatting or backticks.
    `;

    // Strategy 1: Google Gemini (Primary)
    if (GEMINI_KEY) {
        try {
            console.log('--- Strategy 1: Google Gemini Execution ---');
            const genAI = new GoogleGenerativeAI(GEMINI_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const cleanJson = extractJSON(text);
            if (cleanJson) return cleanJson;
        } catch (error) {
            console.warn('Gemini Strategy Failed (Rate limit or API issue):', error.message);
        }
    }

    // Strategy 2: Groq (Secondary Fallback)
    if (GROQ_KEY) {
        try {
            console.log('--- Strategy 2: Groq (Llama3) Fallback Execution ---');
            const groqRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: GROQ_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                response_format: { type: "json_object" }
            }, {
                headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' }
            });
            const content = groqRes.data.choices[0].message.content;
            return JSON.parse(content);
        } catch (error) {
            console.warn('Groq Strategy Failed:', error.message);
        }
    }

    // Strategy 3: Hugging Face (Tertiary Fallback)
    if (HF_TOKEN) {
        try {
            console.log('--- Strategy 3: Hugging Face Fallback Execution ---');
            const hfRes = await axios.post(
                `https://api-inference.huggingface.co/models/${HF_MODEL}`,
                { inputs: prompt },
                { headers: { Authorization: `Bearer ${HF_TOKEN}` } }
            );
            const resultText = hfRes.data[0]?.generated_text || '';
            const cleanJson = extractJSON(resultText);
            if (cleanJson) return cleanJson;
        } catch (error) {
            console.warn('Hugging Face Strategy Failed:', error.message);
        }
    }

    // Final Strategy: Heuristic Local Fallback
    console.log('--- Final Strategy: Local Heuristic Fallback (Offline) ---');
    return simulatedAIAnalysis(code, testResults);
}

/**
 * Helper to extract JSON from AI string responses
 */
function extractJSON(text) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        return null;
    }
    return null;
}

/**
 * Heuristic fallback for offline/limit scenarios
 */
function simulatedAIAnalysis(code, testResults) {
    const passCount = testResults.filter(r => r.isPassed).length;
    const totalCount = testResults.length;
    const score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

    let quality = "Logic is logically consistent with outputs.";
    if (score === 100) quality = "Excellent! All edge cases satisfied.";
    else if (score > 50) quality = "Functional logic with minor edge-case failures.";
    else quality = "Critical logic mismatch with requirements.";

    let suggestions = "Review nested loops and variable scopes.";
    if (code.includes('for') && code.includes('if')) suggestions = "Ensure termination conditions are correct.";
    if (score < 100) suggestions = "Check input boundary conditions (null/empty inputs).";

    return {
        quality,
        complexity: "O(n) - Estimated heuristically",
        suggestions,
        logicScore: score
    };
}

module.exports = { analyzeCode };
