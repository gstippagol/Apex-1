const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

// Language Map for Local and Cloud
const languageMap = {
    'c': { judge0Id: 50, pistonName: 'c', version: '10.2.0' },
    'cpp': { judge0Id: 54, pistonName: 'cpp', version: '10.2.0' },
    'java': { judge0Id: 91, pistonName: 'java', version: '15.0.2' },
    'python': { judge0Id: 92, pistonName: 'python', version: '3.10.0' },
    'javascript': { judge0Id: 97, pistonName: 'javascript', version: '18.15.0' }
};

class ConcurrencyLimiter {
    constructor(concurrency) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    async add(task) {
        if (this.running >= this.concurrency) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        this.running++;
        try {
            return await task();
        } finally {
            this.running--;
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                next();
            }
        }
    }
}

// Limit to 5 concurrent compiler processes to prevent CPU/RAM crashes
const compilerQueue = new ConcurrencyLimiter(5);

async function executeCode(code, language, input = '') {
    return compilerQueue.add(async () => {
        const id = uuidv4();
        const folderPath = path.join(TEMP_DIR, id);
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

        const lang = language.toLowerCase();

        try {
        // STEP 1: Attempt Local Execution
        let localResult = null;
        if (lang === 'python') localResult = await runPython(code, input, folderPath);
        else if (lang === 'javascript') localResult = await runNode(code, input, folderPath);
        else if (lang === 'cpp' || lang === 'c') localResult = await runCpp(code, input, folderPath, lang);

        if (localResult && localResult.success) {
            return localResult;
        }

        // Only fallback to cloud if local failed due to missing compiler/runtime (environment issues)
        const isEnvError = localResult && localResult.error && (
            localResult.error.includes('is not recognized') || 
            localResult.error.includes('command not found') ||
            localResult.error.includes('ENOENT') ||
            localResult.error.includes('The system cannot execute')
        );

        if (localResult && !isEnvError) {
            // It was a valid execution that resulted in a syntax/compilation/runtime error.
            // Return it immediately so we don't waste time on Cloud Relay.
            return localResult;
        }

        // STEP 2: Cloud Relay fallback (or for Java)
        try {
            const cloudResult = await runCloudRelay(code, lang, input);
            return cloudResult;
        } catch (e) {
            if (localResult) return localResult;
            throw e;
        }

    } catch (err) {
        console.error('Final Execution Failure:', err.message);
        return { 
            success: false, 
            error: 'Evolutionary Execution Failure: The logic core is currently offline. Please ensure the target language is installed on the hosting server.' 
        };
    } finally {
        setTimeout(() => {
            try { if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true }); } catch (e) {}
        }, 2000);
    }
    });
}

async function runCloudRelay(code, lang, input) {
    const config = languageMap[lang];
    if (!config) throw new Error('Unsupported Language');

    // Industry Standard: Base64 Encoding to bypass firewalls/DPI
    const base64Code = Buffer.from(code).toString('base64');
    const base64Input = Buffer.from(input).toString('base64');

    // Try Judge0 (Tier 1 Cloud)
    try {
        const res = await axios.post('https://ce.judge0.com/submissions?base64_encoded=true&wait=true', {
            source_code: base64Code,
            language_id: config.judge0Id,
            stdin: base64Input
        }, { timeout: 15000 });

        const { stdout, stderr, compile_output, status } = res.data;
        const out = stdout ? Buffer.from(stdout, 'base64').toString() : '';
        const err = stderr ? Buffer.from(stderr, 'base64').toString() : '';
        const compOut = compile_output ? Buffer.from(compile_output, 'base64').toString() : '';

        if (status.id === 3) return { success: true, stdout: out };
        if (status.id === 6) return { success: false, error: compOut, isCompilationError: true };
        return { success: false, error: err || status.description };
    } catch (e) {
        // Fallback to Piston (Tier 2 Cloud)
        return await runPiston(code, lang, input);
    }
}

async function runPiston(code, lang, input) {
    const config = languageMap[lang];
    try {
        const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: config.pistonName,
            version: '*',
            files: [{ content: code }],
            stdin: input
        }, { timeout: 10000 });

        const { run, compile } = response.data;
        if (compile && compile.stderr) return { success: false, error: compile.stderr, isCompilationError: true };
        if (run.stderr) return { success: false, error: run.stderr };
        return { success: true, stdout: run.stdout };
    } catch (err) {
        throw new Error('Both Cloud Relays Unreachable');
    }
}

// Local Runner Utils (Fast Native Path)
async function runPython(code, input, folder) {
    const filePath = path.join(folder, 'script.py');
    fs.writeFileSync(filePath, code);
    const result = await executeCommand(`python "${filePath}"`, input);
    // Only flag true syntax errors as compilation errors to prevent skipping all test cases
    if (!result.success && result.error && (result.error.includes('SyntaxError') || result.error.includes('IndentationError'))) {
        result.isCompilationError = true;
    }
    return result;
}

async function runNode(code, input, folder) {
    const filePath = path.join(folder, 'script.js');
    fs.writeFileSync(filePath, code);
    return await executeCommand(`node "${filePath}"`, input);
}

async function runCpp(code, input, folder, lang) {
    const ext = lang === 'c' ? 'c' : 'cpp';
    const compiler = lang === 'c' ? 'gcc' : 'g++';
    const sourcePath = path.join(folder, `source.${ext}`);
    const outputPath = path.join(folder, 'program.exe');
    fs.writeFileSync(sourcePath, code);
    // Compile step — uses empty input, check for compile error
    const compileResult = await executeCommand(`${compiler} "${sourcePath}" -o "${outputPath}"`, '');
    if (!compileResult.success) {
        return { success: false, error: compileResult.error, isCompilationError: true };
    }
    return executeCommand(`"${outputPath}"`, input);
}

function executeCommand(command, input) {
    return new Promise((resolve, reject) => {
        const child = exec(command, { timeout: 10000, maxBuffer: 1024 * 1024 });
        let stdout = '', stderr = '';
        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });
        // Always write input and close stdin (empty string for no-input problems)
        if (child.stdin) {
            try {
                child.stdin.write(input || '');
                child.stdin.end();
            } catch (e) { /* stdin may already be closed */ }
        }
        child.on('close', (c) => {
            if (c === 0) resolve({ success: true, stdout });
            else resolve({ success: false, error: stderr || stdout || `Process exited with code ${c}` });
        });
        child.on('error', (e) => resolve({ success: false, error: e.message }));
    });
}

module.exports = { executeCode };
