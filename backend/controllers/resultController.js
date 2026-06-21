const Result = require('../models/Result');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const { executeCode } = require('../utils/executor');
const { analyzeCode } = require('../utils/ai');

const flexibleMatch = (output, expected) => {
    if (output === undefined || expected === undefined) return false;
    const normalize = (str) => str.toString().trim().replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
    return normalize(output) === normalize(expected);
};

exports.submitExam = async (req, res) => {
    try {
        const { examId, answers, violations } = req.body;
        const userId = req.user.id;

        // Check for existing attempt (Block only if Suspended)
        let result = await Result.findOne({ userId, examId });
        if (result && result.status === 'Suspended') {
            return res.status(403).json({ success: false, message: 'Your session has been suspended by an administrator.' });
        }

        const exam = await Exam.findById(examId).populate('questions');
        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        let score = 0;
        let totalCodingScore = 0;
        let totalPossibleMarks = 0;
        const processedAnswers = [];

        // Pre-calculate total possible marks
        exam.questions.forEach(q => {
            totalPossibleMarks += (q.marks !== undefined ? q.marks : 1);
        });

        for (const answer of answers) {
            const question = exam.questions.find(q => q._id.toString() === answer.questionId);
            if (!question) continue;

            const questionMarks = question.marks !== undefined ? question.marks : 1;

            if (question.type === 'Coding') {
                const code = answer.code || '';
                const language = answer.language || 'c';

                // Check if we need to evaluate the code
                let codingResults = answer.codingResults;
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
                const codingScore = weight * questionMarks;
                
                score += codingScore;
                totalCodingScore += codingScore;

                processedAnswers.push({
                    questionId: question._id,
                    code,
                    language,
                    codingResults,
                    isCorrect: totalTC > 0 && passedTC === totalTC
                });
            } else {
                const isCorrect = question.correctAnswer === answer.selectedOption;
                if (isCorrect) score += questionMarks;
                processedAnswers.push({
                    questionId: question._id,
                    selectedOption: answer.selectedOption,
                    isCorrect
                });
            }
        }
        
        const verdict = score >= (exam.passingMarks || 0) ? 'Pass' : 'Fail';

        if (result) {
            // Update existing ongoing result
            result.score = Number(score.toFixed(2));
            result.totalMarks = totalPossibleMarks;
            result.totalCodingScore = Number(totalCodingScore.toFixed(2));
            result.timeTaken = req.body.timeTaken || 0;
            result.totalQuestions = exam.questions.length;
            result.answers = processedAnswers;
            result.violations = violations;
            result.status = 'Submitted';
            result.verdict = verdict;
            await result.save();
        } else {
            // Fallback: Create if not exists (though startExam should have created it)
            result = await Result.create({
                userId,
                examId,
                score: Number(score.toFixed(2)),
                totalMarks: totalPossibleMarks,
                totalCodingScore: Number(totalCodingScore.toFixed(2)),
                timeTaken: req.body.timeTaken || 0,
                totalQuestions: exam.questions.length,
                answers: processedAnswers,
                violations,
                status: 'Submitted',
                verdict: verdict,
                isPublished: false 
            });
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('data-updated', { type: 'result', action: 'submit' });
            io.to(`admin-${examId}`).emit('session-submitted', {
                resultId: result._id,
                userId: userId.toString(),
                status: 'Submitted'
            });
        }

        res.status(201).json({ success: true, data: result });
    } catch (err) {
        console.error('Submission Error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getUserResults = async (req, res) => {
    try {
        const results = await Result.find({ 
            userId: req.user.id
        }).populate({
            path: 'examId',
            select: 'title questions passingMarks proctoring',
            populate: { path: 'questions', select: 'marks' }
        });
        
        // Fallback for legacy data
        const processedResults = results.map(r => {
            const resultObj = r.toObject();
            if (!resultObj.totalMarks && resultObj.examId?.questions) {
                resultObj.totalMarks = resultObj.examId.questions.reduce((acc, q) => acc + (q.marks !== undefined ? q.marks : 1), 0);
            }
            return resultObj;
        });

        res.status(200).json({ success: true, data: processedResults });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getResultsByExam = async (req, res) => {
    try {
        const results = await Result.find({ examId: req.params.examId })
            .populate('userId', 'name email usn role')
            .populate({
                path: 'examId',
                select: 'title questions passingMarks proctoring',
                populate: { path: 'questions' } // Populate full question details
            })
            .populate('answers.questionId'); // Populate answers to show question text
            
        // Fallback for missing totalMarks (legacy data)
        const processedResults = results
            .filter(r => r.userId && r.userId.role === 'student')
            .map(r => {
                const resultObj = r.toObject();
                if (!resultObj.totalMarks && resultObj.examId?.questions) {
                    resultObj.totalMarks = resultObj.examId.questions.reduce((acc, q) => acc + (q.marks !== undefined ? q.marks : 1), 0);
                }
                return resultObj;
            });

        res.status(200).json({ success: true, data: processedResults });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.publishResults = async (req, res) => {
    try {
        const { examId } = req.params;
        
        const results = await Result.updateMany(
            { examId: examId }, 
            { $set: { isPublished: true } }
        );
        
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'result', action: 'publish-bulk' });

        res.status(200).json({ 
            success: true, 
            message: `Successfully synchronized ${results.modifiedCount || results.nModified || 0} performance ledgers.`,
            count: results.modifiedCount || results.nModified || 0
        });
    } catch (err) {
        console.error('Publish Error:', err);
        res.status(400).json({ success: false, message: 'Protocol synchronization failed' });
    }
};

exports.toggleAttendance = async (req, res) => {
    try {
        const result = await Result.findById(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Result not found' });

        const updatedResult = await Result.findByIdAndUpdate(
            req.params.id,
            { attendance: result.attendance === 'Present' ? 'Absent' : 'Present' },
            { new: true, runValidators: false }
        );

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'result', action: 'attendance-toggle' });

        res.status(200).json({ success: true, data: updatedResult });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.toggleIndividualPublish = async (req, res) => {
    try {
        const result = await Result.findById(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Result not found' });

        const updatedResult = await Result.findByIdAndUpdate(
            req.params.id,
            { isPublished: !result.isPublished },
            { new: true }
        );

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'result', action: 'publish-toggle' });

        res.status(200).json({ success: true, data: updatedResult });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getResultById = async (req, res) => {
    try {
        const result = await Result.findById(req.params.id)
            .populate('userId', 'name email usn')
            .populate({
                path: 'examId',
                select: 'title questions passingMarks proctoring',
                populate: { path: 'questions' }
            })
            .populate('answers.questionId');
            
        if (!result) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }

        const resultObj = result.toObject();
        // Fallback for legacy data
        if (!resultObj.totalMarks && resultObj.examId?.questions) {
            resultObj.totalMarks = resultObj.examId.questions.reduce((acc, q) => acc + (q.marks !== undefined ? q.marks : 1), 0);
        }
        
        if (req.user.role !== 'admin' && result.userId._id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized for this protocol clearance' });
        }

        res.status(200).json({ success: true, data: resultObj });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getAllResults = async (req, res) => {
    try {
        const results = await Result.find()
            .populate('userId', 'name email usn role')
            .populate({
                path: 'examId',
                select: 'title questions passingMarks proctoring',
                populate: { path: 'questions', select: 'marks' }
            });

        // Fallback for legacy data
        const processedResults = results
            .filter(r => r.userId && r.userId.role === 'student')
            .map(r => {
                const resultObj = r.toObject();
                if (!resultObj.totalMarks && resultObj.examId?.questions) {
                    resultObj.totalMarks = resultObj.examId.questions.reduce((acc, q) => acc + (q.marks !== undefined ? q.marks : 1), 0);
                }
                return resultObj;
            });

        res.status(200).json({ success: true, data: processedResults });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

/* ── Admin: delete a result so the student can retake the exam ── */
exports.deleteResult = async (req, res) => {
    try {
        const result = await Result.findById(req.params.id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }
        await result.deleteOne();

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'result', action: 'delete' });

        res.status(200).json({ success: true, message: 'Result deleted. Student may now retake the exam.' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
/* ── Monitoring: Start an exam session ── */
exports.startExam = async (req, res) => {
    try {
        const { examId } = req.body;
        const userId = req.user.id;

        const exam = await Exam.findById(examId);
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

        if (exam.status !== 'Published' && exam.status !== 'Ongoing') {
            return res.status(403).json({ success: false, message: 'This assessment is not currently active.' });
        }

        let result = await Result.findOne({ userId, examId });
        
        if (result) {
            // Block starting or resuming if already submitted
            if (result.status === 'Submitted') {
                return res.status(400).json({ success: false, message: 'You have already submitted this assessment.' });
            }
            // Block starting or resuming if suspended
            if (result.status === 'Suspended') {
                return res.status(403).json({ success: false, message: 'Your session has been suspended by an administrator.' });
            }
            // Keep status as Ongoing, update lastActive timestamp
            result.lastActive = Date.now();
            await result.save();
            return res.status(200).json({ success: true, data: result });
        }

        result = await Result.create({
            userId,
            examId,
            score: 0,
            totalQuestions: exam.questions.length,
            status: 'Ongoing',
            lastActive: Date.now()
        });

        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

/* ── Monitoring: Get all active sessions ── */
exports.getActiveSessions = async (req, res) => {
    try {
        const thresholdTime = new Date(Date.now() - 45000);
        const sessions = await Result.find({ 
            status: 'Ongoing',
            lastActive: { $gte: thresholdTime }
        })
            .populate('userId', 'name email usn department role')
            .populate('examId', 'title');

        // Filter to ensure unique users (keep only the most recent session per user)
        const uniqueUsers = new Map();
        sessions.filter(s => s.userId && s.userId.role === 'student').forEach(session => {
            const userId = session.userId?._id?.toString();
            if (!uniqueUsers.has(userId) || new Date(session.lastActive) > new Date(uniqueUsers.get(userId).lastActive)) {
                uniqueUsers.set(userId, session);
            }
        });

        res.status(200).json({ success: true, data: Array.from(uniqueUsers.values()) });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

/* ── Monitoring: Suspend a session ── */
exports.suspendResult = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const result = await Result.findByIdAndUpdate(id, {
            status: 'Suspended',
            suspensionReason: reason || 'Protocol violation detected'
        }, { new: true });
        
        if (!result) return res.status(404).json({ success: false, message: 'Result not found' });

        // Real-time notification to the student
        const io = req.app.get('io');
        if (io) {
            io.to(`student-${result.userId}`).emit('session-suspended', {
                examId: result.examId,
                reason: result.suspensionReason
            });
            io.emit('data-updated', { type: 'result', action: 'suspend' });
        }

        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

/* ── Monitoring: Update a live session data (snapshot, mic, violations) ── */
exports.updateSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { snapshot, micActivity, violations } = req.body;
        const update = { lastActive: Date.now() };
        if (snapshot) update.liveSnapshot = snapshot;
        if (micActivity !== undefined) update.micActivity = micActivity;
        if (violations) update.violations = violations;
        
        await Result.findByIdAndUpdate(id, update);
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false });
    }
};
