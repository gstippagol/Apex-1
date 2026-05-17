const Question = require('../models/Question');
const { executeCode } = require('../utils/executor');
const { analyzeCode } = require('../utils/ai');

// Flexible matching logic (Normalization)
const flexibleMatch = (output, expected) => {
    if (output === undefined || expected === undefined) return false;
    
    // Normalize: remove trailing spaces, normalize newlines, lowercase
    const normalize = (str) => str.toString().trim().replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
    
    const nOutput = normalize(output);
    const nExpected = normalize(expected);
    
    return nOutput === nExpected;
};

exports.runCode = async (req, res) => {
    try {
        const { code, language, input, checkAll, questionId } = req.body;

        if (checkAll && questionId) {
            // Delegate to submitCode for full test-case comparison
            return exports.submitCode(req, res);
        }

        const result = await executeCode(code, language, input || '');

        if (!result.success) {
            return res.status(200).json({
                success: false,
                output: result.error,
                isError: true
            });
        }

        res.status(200).json({
            success: true,
            output: result.stdout,
            isError: false
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.submitCode = async (req, res) => {
    try {
        const { code, language, questionId } = req.body;
        const question = await Question.findById(questionId);

        if (!question || question.type !== 'Coding') {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }

        const testCases = question.codingMetadata.testCases;
        let passCount = 0;
        const totalCount = testCases.length;
        const results = [];
        let compilationError = null;
        let firstRuntimeError = null;

        for (const tc of testCases) {
            // If we already hit a compile error, mark remaining cases as failed
            if (compilationError) {
                results.push({
                    input: tc.input,
                    expected: tc.expectedOutput,
                    actual: '',
                    isPassed: false,
                    isVisible: tc.isVisible
                });
                continue;
            }

            const result = await executeCode(code, language, tc.input);

            if (!result.success) {
                // Compilation error — record it and fail all remaining cases
                if (result.isCompilationError) {
                    compilationError = result.error;
                } else if (!firstRuntimeError) {
                    firstRuntimeError = result.error;
                }
                results.push({
                    input: tc.input,
                    expected: tc.expectedOutput,
                    actual: result.error || '',
                    isPassed: false,
                    isVisible: tc.isVisible
                });
                continue;
            }

            const isPassed = flexibleMatch(result.stdout, tc.expectedOutput);
            if (isPassed) passCount++;
            results.push({
                input: tc.input,
                expected: tc.expectedOutput,
                actual: result.stdout,
                isPassed,
                isVisible: tc.isVisible
            });
        }

        // AI feedback (non-blocking — skip if error)
        let aiFeedback = null;
        try {
            aiFeedback = await analyzeCode(
                code, language,
                question.questionText,
                question.codingMetadata.constraints,
                results,
                question.codingMetadata.starterCode?.[language] || ''
            );
        } catch (e) { /* AI is optional */ }

        return res.status(200).json({
            success: passCount === totalCount && !compilationError,
            passCount,
            totalCount,
            results,
            aiFeedback,
            message: compilationError
                ? `Compilation Error:\n${compilationError}`
                : firstRuntimeError
                    ? `Runtime Error:\n${firstRuntimeError}`
                    : passCount === totalCount
                        ? 'All test cases passed!'
                        : `${passCount} / ${totalCount} test cases passed.`
        });

    } catch (err) {
        console.error('[submitCode] Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Server error during submission' });
    }
};


