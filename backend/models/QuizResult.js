const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    quizId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Quiz',
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    totalMarks: {
        type: Number,
        required: true,
        default: 0
    },
    totalQuestions: {
        type: Number,
        required: true
    },
    answers: [
        {
            questionId: {
                type: mongoose.Schema.ObjectId,
                ref: 'Question'
            },
            selectedOption: String,
            isCorrect: Boolean,
            // For coding questions
            code: String,
            language: String,
            codingResults: {
                testCasesPassed: Number,
                totalTestCases: Number,
                aiFeedback: {
                    quality: String,
                    complexity: String,
                    suggestions: String,
                    logicScore: Number
                }
            }
        }
    ],
    timeTaken: {
        type: Number,
        default: 0
    },
    violations: {
        tabSwitches: { type: Number, default: 0 },
        fullscreenExits: { type: Number, default: 0 }
    },
    status: {
        type: String,
        enum: ['Ongoing', 'Submitted'],
        default: 'Submitted'
    },
    submissionType: {
        type: String,
        enum: ['Normal', 'Auto'],
        default: 'Normal'
    },
    verdict: {
        type: String,
        enum: ['Pass', 'Fail'],
        default: 'Fail'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure unique result per user per quiz
quizResultSchema.index({ userId: 1, quizId: 1 }, { unique: true });
quizResultSchema.index({ status: 1 });
quizResultSchema.index({ createdAt: -1 });

module.exports = mongoose.model('QuizResult', quizResultSchema);
