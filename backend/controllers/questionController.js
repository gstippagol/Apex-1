const Question = require('../models/Question');
const Exam = require('../models/Exam');

exports.createQuestion = async (req, res) => {
    try {
        req.body.createdBy = req.user.id;
        const question = await Question.create(req.body);
        res.status(201).json({ success: true, data: question });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getQuestions = async (req, res) => {
    try {
        const questions = await Question.find({ createdBy: req.user.id });
        res.status(200).json({ success: true, data: questions });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getAllQuestions = async (req, res) => {
    try {
        const questions = await Question.find();
        res.status(200).json({ success: true, data: questions });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateQuestion = async (req, res) => {
    try {
        let question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }
        question = await Question.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        res.status(200).json({ success: true, data: question });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteQuestion = async (req, res) => {
    try {
        const questionId = req.params.id;
        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }

        // Remove the question ID from any exams that reference it
        await Exam.updateMany(
            { questions: questionId },
            { $pull: { questions: questionId } }
        );

        await question.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
