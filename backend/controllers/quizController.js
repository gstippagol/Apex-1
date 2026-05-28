const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const Question = require('../models/Question');
const { executeCode } = require('../utils/executor');
const { analyzeCode } = require('../utils/ai');

const flexibleMatch = (output, expected) => {
    if (output === undefined || expected === undefined) return false;
    const normalize = (str) => str.toString().trim().replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
    return normalize(output) === normalize(expected);
};

exports.createQuiz = async (req, res) => {
    try {
        req.body.createdBy = req.user.id;
        const quiz = await Quiz.create(req.body);
        
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'quiz', action: 'create' });

        res.status(201).json({ success: true, data: quiz });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getQuizzes = async (req, res) => {
    try {
        let query;
        if (req.user.role === 'admin' || req.user.role === 'superadmin') {
            query = Quiz.find().populate('createdBy', 'name').populate('questions', 'marks').sort({ createdAt: -1 });
        } else {
            query = Quiz.find({ 
                status: { $in: ['Published', 'Ongoing', 'Stopped'] },
                $or: [
                    { targetDepartments: { $in: ['All', req.user.department] } },
                    { targetDepartments: { $exists: false } },
                    { targetDepartments: { $size: 0 } }
                ]
            }).populate('createdBy', 'name').populate('questions', 'marks').sort({ createdAt: -1 });
        }
        const quizzes = await query;
        res.status(200).json({ success: true, data: quizzes });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id).populate('questions');
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }
        res.status(200).json({ success: true, data: quiz });
    } catch (err) {
        res.status(400).json({ success: false, message: 'Invalid Quiz ID' });
    }
};

exports.updateQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'quiz', action: 'update' });
        res.status(200).json({ success: true, data: quiz });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

        await Question.deleteMany({ _id: { $in: quiz.questions } });
        // Cascade delete: Remove all student quiz results associated with this quiz
        await QuizResult.deleteMany({ quizId: req.params.id });
        await quiz.deleteOne();

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'quiz', action: 'delete' });

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Quiz Submission
exports.submitQuiz = async (req, res) => {
    try {
        const { quizId, answers, score, totalMarks, totalQuestions, timeTaken } = req.body;
        
        const processedAnswers = [];
        let finalScore = 0;

        for (const ans of answers) {
            const question = await Question.findById(ans.questionId);
            if (!question) continue;

            const questionMarks = question.marks !== undefined ? question.marks : 1;

            if (question.type === 'Coding') {
                const code = ans.code || '';
                const language = ans.language || 'c';

                // Check if we need to evaluate the code
                let codingResults = ans.codingResults;
                if (!codingResults || !codingResults.aiFeedback || !codingResults.aiFeedback.quality || codingResults.aiFeedback.quality === 'N/A') {
                    // Let's run the test cases and generate AI feedback on the backend
                    const testCases = question.codingMetadata?.testCases || [];
                    let passCount = 0;
                    const totalCount = testCases.length;
                    const results = [];
                    let compilationError = null;

                    for (const tc of testCases) {
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

                        try {
                            const result = await executeCode(code, language, tc.input);

                            if (!result.success) {
                                if (result.isCompilationError) {
                                    compilationError = result.error;
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
                        } catch (err) {
                            results.push({
                                input: tc.input,
                                expected: tc.expectedOutput,
                                actual: err.message || 'Execution error',
                                isPassed: false,
                                isVisible: tc.isVisible
                            });
                        }
                    }

                    let aiFeedback = null;
                    try {
                        aiFeedback = await analyzeCode(
                            code, language,
                            question.questionText,
                            question.codingMetadata?.constraints || '',
                            results,
                            question.codingMetadata?.starterCode?.[language] || ''
                        );
                    } catch (e) {
                        const scorePct = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;
                        aiFeedback = {
                            quality: scorePct === 100 ? "Excellent! All edge cases satisfied." : "Functional logic with edge-case failures.",
                            complexity: "O(n) - Estimated heuristically",
                            suggestions: "Review edge cases and boundaries.",
                            logicScore: scorePct
                        };
                    }

                    codingResults = {
                        testCasesPassed: passCount,
                        totalTestCases: totalCount,
                        aiFeedback
                    };
                }

                const totalTC = codingResults.totalTestCases || 0;
                const passedTC = codingResults.testCasesPassed || 0;
                const weight = totalTC > 0 ? (passedTC / totalTC) : 0;
                finalScore += questionMarks * weight;

                processedAnswers.push({
                    questionId: question._id,
                    code,
                    language,
                    codingResults,
                    isCorrect: totalTC > 0 && passedTC === totalTC
                });
            } else {
                const isCorrect = question.correctAnswer === ans.selectedOption;
                if (isCorrect) finalScore += questionMarks;
                processedAnswers.push({
                    questionId: question._id,
                    selectedOption: ans.selectedOption,
                    isCorrect
                });
            }
        }
        
        let quizResult = await QuizResult.findOne({ userId: req.user.id, quizId });
        
        if (quizResult) {
            return res.status(400).json({ success: false, message: 'You have already submitted this assessment.' });
        }

        quizResult = await QuizResult.create({
            userId: req.user.id,
            quizId,
            answers: processedAnswers,
            score: Number(finalScore.toFixed(2)),
            totalMarks,
            totalQuestions,
            timeTaken,
            violations: req.body.violations || { tabSwitches: 0, fullscreenExits: 0 },
            status: 'Submitted',
            submissionType: req.body.submissionType || 'Normal',
            verdict: finalScore >= (totalMarks * 0.4) ? 'Pass' : 'Fail' // Default 40% passing
        });

        res.status(201).json({ success: true, data: quizResult });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Quiz Monitoring (Results)
exports.getQuizResults = async (req, res) => {
    try {
        const { quizId } = req.query;
        let query = QuizResult.find()
            .populate('userId', 'name email usn department')
            .populate('quizId', 'title')
            .populate('answers.questionId', 'questionText type correctAnswer marks');
        
        // If student, only show their results
        if (req.user.role === 'student') {
            query = query.where('userId').equals(req.user.id);
        }

        if (quizId) {
            query = query.where('quizId').equals(quizId);
        }

        const results = await query.sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: results });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.publishQuiz = async (req, res) => {
    try {
        const { targetDepartments } = req.body;
        const quiz = await Quiz.findByIdAndUpdate(req.params.id, { 
            status: 'Published',
            targetDepartments: targetDepartments || ['All']
        }, { new: true });
        res.status(200).json({ success: true, data: quiz });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.stopQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findByIdAndUpdate(req.params.id, { status: 'Stopped' }, { new: true });
        res.status(200).json({ success: true, data: quiz });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.withdrawQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findByIdAndUpdate(req.params.id, { status: 'Withdrawn' }, { new: true });
        
        // Delete all student results associated with this quiz when withdrawn
        await QuizResult.deleteMany({ quizId: req.params.id });

        res.status(200).json({ success: true, data: quiz });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.restartQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findByIdAndUpdate(req.params.id, { status: 'Published' }, { new: true });
        res.status(200).json({ success: true, message: 'Quiz protocol reactivated', data: quiz });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteQuizResult = async (req, res) => {
    try {
        const result = await QuizResult.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }
        res.status(200).json({ success: true, message: 'Retest granted (result cleared)' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
