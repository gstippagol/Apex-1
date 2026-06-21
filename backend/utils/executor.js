const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// ─────────────────────────────────────────────────────────────
//  TEMP DIRECTORY (used only in local/dev mode)
// ─────────────────────────────────────────────────────────────
const TEMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// ─────────────────────────────────────────────────────────────
//  LANGUAGE MAP — IDs for every cloud provider
// ─────────────────────────────────────────────────────────────
const languageMap = {
    c:          { judge0Id: 50,  pistonName: 'c',          jdoodleLanguage: 'c',       jdoodleVersionIndex: '5' },
    cpp:        { judge0Id: 54,  pistonName: 'cpp',         jdoodleLanguage: 'cpp17',   jdoodleVersionIndex: '0' },
    java:       { judge0Id: 91,  pistonName: 'java',        jdoodleLanguage: 'java',    jdoodleVersionIndex: '4' },
    python:     { judge0Id: 92,  pistonName: 'python',      jdoodleLanguage: 'python3', jdoodleVersionIndex: '4' },
    javascript: { judge0Id: 97,  pistonName: 'javascript',  jdoodleLanguage: 'nodejs',  jdoodleVersionIndex: '4' },
};

// ─────────────────────────────────────────────────────────────
//  CONCURRENCY LIMITER — prevents CPU/RAM spikes
// ─────────────────────────────────────────────────────────────
class ConcurrencyLimiter {
    constructor(concurrency) { this.concurrency = concurrency; this.running = 0; this.queue = []; }
    async add(task) {
        if (this.running >= this.concurrency) await new Promise(r => this.queue.push(r));
        this.running++;
        try   { return await task(); }
        finally { this.running--; if (this.queue.length) this.queue.shift()(); }
    }
}
const compilerQueue = new ConcurrencyLimiter(50); // Increased from 5 to 50 for high concurrency

// ─────────────────────────────────────────────────────────────
//  QUOTA-AWARE LOAD BALANCER
//
//  Two failure categories are tracked separately:
//
//  1. QUOTA_EXHAUSTED  (429, 402, or API-specific "limit exceeded" body)
//     → Provider is DISABLED until midnight UTC (reset daily).
//     → Failover is INSTANTANEOUS — no wait, just skip to next.
//
//  2. TRANSIENT_ERROR  (network timeout, 500, 503, unexpected error)
//     → Provider enters a 60-second cool-down.
//     → After cool-down it is retried normally.
// ─────────────────────────────────────────────────────────────
const TRANSIENT_COOLDOWN_MS = 60_000;   // 60 s cool-down for transient failures
const TRANSIENT_FAIL_THRESH = 3;        // failures before cool-down kicks in

// Returns ms until next UTC midnight (quota resets)
function msUntilMidnightUTC() {
    const now  = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return next - now;
}

// Recognise quota / rate-limit signals from HTTP status or body text
function isQuotaError(err) {
    const status = err?.response?.status;
    const body   = JSON.stringify(err?.response?.data || '').toLowerCase();
    const msg    = (err?.message || '').toLowerCase();

    if (status === 429) return true;                          // Standard rate-limit
    if (status === 402) return true;                         // Payment required / quota
    if (status === 403 && (
        body.includes('quota') || body.includes('limit') ||
        body.includes('exceeded') || body.includes('credit') ||
        body.includes('daily') || body.includes('plan')
    )) return true;
    if (msg.includes('quota') || msg.includes('daily limit') ||
        msg.includes('credit') || msg.includes('exceeded') ||
        msg.includes('rate limit')) return true;

    // JDoodle-specific: returns 200 but body says "400" with "Limit"
    if (body.includes('"statuscode":400') && body.includes('limit')) return true;
    if (body.includes('calls today')) return true;

    return false;
}

class Provider {
    constructor(name, fn) {
        this.name          = name;
        this.fn            = fn;
        this.failures      = 0;             // transient failure counter
        this.blockedUntil  = 0;             // transient cool-down timestamp
        this.quotaUntil    = 0;             // quota-exhausted timestamp (until midnight)
    }

    get isAvailable() {
        return Date.now() >= this.quotaUntil && Date.now() >= this.blockedUntil;
    }

    onSuccess() {
        this.failures     = 0;
        this.blockedUntil = 0;
        console.log(`[LB] ✓ ${this.name} succeeded`);
    }

    onQuotaExhausted() {
        const resetIn       = msUntilMidnightUTC();
        this.quotaUntil     = Date.now() + resetIn;
        this.failures       = 0;
        console.warn(`[LB] ⛔ ${this.name} QUOTA EXHAUSTED — disabled until midnight UTC (${Math.round(resetIn / 60000)} min)`);
    }

    onTransientError(errMsg) {
        this.failures++;
        if (this.failures >= TRANSIENT_FAIL_THRESH) {
            this.blockedUntil = Date.now() + TRANSIENT_COOLDOWN_MS;
            this.failures     = 0;
            console.warn(`[LB] ⏳ ${this.name} transient-blocked for ${TRANSIENT_COOLDOWN_MS / 1000}s after ${TRANSIENT_FAIL_THRESH} failures`);
        } else {
            console.warn(`[LB] ✗ ${this.name} transient failure (${this.failures}/${TRANSIENT_FAIL_THRESH}): ${errMsg}`);
        }
    }
}

// Provider registry — order = default priority
const providers = [
    new Provider('Judge0',  runJudge0),
    new Provider('JDoodle', runJDoodle),
    new Provider('Piston',  runPiston),
];

let rrIndex = 0;

function nextAvailableProvider() {
    const available = providers.filter(p => p.isAvailable);
    if (available.length === 0) {
        // All blocked/quota'd — pick the one whose restriction lifts soonest
        return providers.reduce((a, b) => {
            const aUnlock = Math.max(a.quotaUntil, a.blockedUntil);
            const bUnlock = Math.max(b.quotaUntil, b.blockedUntil);
            return aUnlock <= bUnlock ? a : b;
        });
    }
    const p = available[rrIndex % available.length];
    rrIndex  = (rrIndex + 1) % available.length;
    return p;
}

/**
 * Load-balanced cloud relay with instant quota failover.
 * Tries every provider once per call before giving up.
 */
async function runCloudRelay(code, lang, input) {
    const config = languageMap[lang];
    if (!config) throw new Error(`Unsupported language: ${lang}`);

    let lastError = null;
    const tried   = new Set();

    for (let attempt = 0; attempt < providers.length; attempt++) {
        const provider = nextAvailableProvider();
        if (tried.has(provider.name)) continue;   // don't retry same provider in one call
        tried.add(provider.name);

        console.log(`[LB] Attempt ${attempt + 1}/${providers.length} → ${provider.name}`);
        try {
            const result = await provider.fn(code, lang, input, config);
            provider.onSuccess();
            return result;
        } catch (err) {
            lastError = err;
            if (isQuotaError(err)) {
                provider.onQuotaExhausted();  // instant skip — no waiting
            } else {
                provider.onTransientError(err.message);
            }
        }
    }

    throw new Error(`All cloud compiler relays failed. Last: ${lastError?.message}`);
}

// ─────────────────────────────────────────────────────────────
//  PROVIDER IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────

// ── Judge0 CE (community.judge0.com — free, no key required) ──
async function runJudge0(code, lang, input, config) {
    const base64Code  = Buffer.from(code).toString('base64');
    const base64Input = Buffer.from(input || '').toString('base64');

    const res = await axios.post(
        'https://ce.judge0.com/submissions?base64_encoded=true&wait=true',
        { source_code: base64Code, language_id: config.judge0Id, stdin: base64Input },
        { timeout: 20000 }
    );

    if (res.status === 429) throw Object.assign(new Error('Judge0 rate limit'), { response: res });

    const { stdout, stderr, compile_output, status } = res.data;
    const out     = stdout         ? Buffer.from(stdout,         'base64').toString() : '';
    const err     = stderr         ? Buffer.from(stderr,         'base64').toString() : '';
    const compOut = compile_output ? Buffer.from(compile_output, 'base64').toString() : '';

    if (status.id === 3)  return { success: true,  stdout: out };
    if (status.id === 6)  return { success: false,  error: compOut, isCompilationError: true };
    if (status.id === 5)  return { success: false,  error: 'Time Limit Exceeded' };
    if (status.id === 11) return { success: false,  error: 'Runtime Error (NZEC)' };
    if (err) return { success: false, error: err };
    throw new Error(`Judge0 unexpected status: ${status.id} — ${status.description}`);
}

// ── JDoodle (jdoodle.com — 200 free req/day) ──────────────────
async function runJDoodle(code, lang, input, config) {
    const clientId     = process.env.JDOODLE_CLIENT_ID;
    const clientSecret = process.env.JDOODLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('JDoodle credentials not set in .env');

    const response = await axios.post(
        'https://api.jdoodle.com/v1/execute',
        { clientId, clientSecret, script: code, language: config.jdoodleLanguage, versionIndex: config.jdoodleVersionIndex, stdin: input || '' },
        { timeout: 20000 }
    );

    const { output, statusCode, error } = response.data;

    // JDoodle quota: statusCode 400 + specific messages
    if (statusCode === 400) {
        const lc = (output || error || '').toLowerCase();
        if (lc.includes('limit') || lc.includes('quota') || lc.includes('calls today') || lc.includes('exceeded')) {
            const quotaErr = new Error('JDoodle daily quota exhausted');
            quotaErr.response = { status: 429, data: response.data };
            throw quotaErr;
        }
        throw new Error(`JDoodle error: ${output || error || statusCode}`);
    }

    if (statusCode !== 200 || error) throw new Error(`JDoodle error: ${error || statusCode}`);

    // Detect inline compile errors
    if (output && /\berror:\s/i.test(output) && !output.includes('\n')) {
        return { success: false, error: output, isCompilationError: true };
    }

    return { success: true, stdout: output };
}

// ── Piston (emkc.org — open-source, free, no key) ─────────────
async function runPiston(code, lang, input, config) {
    const response = await axios.post(
        'https://emkc.org/api/v2/piston/execute',
        { language: config.pistonName, version: '*', files: [{ content: code }], stdin: input || '' },
        { timeout: 15000, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );

    const { run, compile } = response.data;
    if (compile?.stderr) return { success: false, error: compile.stderr, isCompilationError: true };
    if (run?.stderr)     return { success: false, error: run.stderr };
    return { success: true, stdout: run.stdout };
}

// ─────────────────────────────────────────────────────────────
//  LOCAL RUNNERS  (dev mode only)
// ─────────────────────────────────────────────────────────────
async function detectPythonCmd() {
    return new Promise(resolve => exec('python3 --version', err => resolve(err ? 'python' : 'python3')));
}

async function runPython(code, input, folder) {
    const filePath = path.join(folder, 'script.py');
    fs.writeFileSync(filePath, code);
    const pyCmd  = await detectPythonCmd();
    const result = await executeCommand(`${pyCmd} "${filePath}"`, input);
    if (!result.success && result.error) {
        if (result.error.includes('SyntaxError') || result.error.includes('IndentationError')) result.isCompilationError = true;
        if (result.error.includes('is not recognized') || result.error.includes('command not found') ||
            result.error.includes('ENOENT') || result.error.includes('No such file')) result.isEnvError = true;
    }
    return result;
}

async function runNode(code, input, folder) {
    const filePath = path.join(folder, 'script.js');
    fs.writeFileSync(filePath, code);
    return executeCommand(`node "${filePath}"`, input);
}

async function runCpp(code, input, folder, lang) {
    const ext = lang === 'c' ? 'c' : 'cpp', compiler = lang === 'c' ? 'gcc' : 'g++';
    const src = path.join(folder, `source.${ext}`), out = path.join(folder, 'program.exe');
    fs.writeFileSync(src, code);
    const cr = await executeCommand(`${compiler} "${src}" -o "${out}"`, '');
    if (!cr.success) return { success: false, error: cr.error, isCompilationError: true };
    return executeCommand(`"${out}"`, input);
}

function executeCommand(command, input) {
    return new Promise(resolve => {
        const child = exec(command, { timeout: 10000, maxBuffer: 1024 * 1024 });
        let stdout = '', stderr = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', d => { stderr += d; });
        if (child.stdin) { try { child.stdin.write(input || ''); child.stdin.end(); } catch (_) {} }
        child.on('close', c => c === 0
            ? resolve({ success: true, stdout })
            : resolve({ success: false, error: stderr || stdout || `Process exited with code ${c}` }));
        child.on('error', e => resolve({ success: false, error: e.message }));
    });
}

// ─────────────────────────────────────────────────────────────
//  MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────
async function executeCode(code, language, input = '') {
    return compilerQueue.add(async () => {
        const lang = language.toLowerCase();
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

        // ── PRODUCTION: cloud-first, load-balanced ────────────────
        if (isProduction) {
            try   { return await runCloudRelay(code, lang, input); }
            catch (err) {
                console.error('[Production] All cloud relays failed:', err.message);
                return { success: false, error: 'All compiler services are temporarily unavailable. Please try again in a moment.' };
            }
        }

        // ── DEVELOPMENT: local first, cloud fallback ──────────────
        const id = uuidv4(), folderPath = path.join(TEMP_DIR, id);
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

        try {
            let localResult = null;
            if      (lang === 'python')              localResult = await runPython(code, input, folderPath);
            else if (lang === 'javascript')           localResult = await runNode(code, input, folderPath);
            else if (lang === 'cpp' || lang === 'c') localResult = await runCpp(code, input, folderPath, lang);

            if (localResult?.success) return localResult;

            const isEnvError = localResult?.isEnvError || (localResult?.error && (
                localResult.error.includes('is not recognized') || localResult.error.includes('command not found') ||
                localResult.error.includes('ENOENT') || localResult.error.includes('The system cannot execute') ||
                localResult.error.includes('Permission denied') || localResult.error.includes('EACCES')
            ));

            if (localResult && !isEnvError) return localResult;   // real code error — don't waste cloud credits

            console.log('[Dev] Local compiler missing → cloud relay');
            try   { return await runCloudRelay(code, lang, input); }
            catch (cloudErr) { if (localResult) return localResult; throw cloudErr; }

        } catch (err) {
            console.error('[Dev] Final failure:', err.message);
            return { success: false, error: 'Execution failure: ' + err.message };
        } finally {
            setTimeout(() => { try { if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true }); } catch (_) {} }, 2000);
        }
    });
}

module.exports = { executeCode };
