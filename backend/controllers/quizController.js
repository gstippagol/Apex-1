const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const Question = require('../models/Question');

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
        
        const quizResult = await QuizResult.create({
            userId: req.user.id,
            quizId,
            answers,
            score,
            totalMarks,
            totalQuestions,
            timeTaken,
            status: 'Submitted',
            verdict: score >= (totalMarks * 0.4) ? 'Pass' : 'Fail' // Default 40% passing
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
