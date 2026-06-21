const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    examId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Exam',
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
    violations: {
        tabSwitches: { type: Number, default: 0 },
        fullscreenExits: { type: Number, default: 0 },
        aiViolations: { type: Number, default: 0 }
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    attendance: {
        type: String,
        enum: ['Present', 'Absent'],
        default: 'Present'
    },
    timeTaken: {
        type: Number,
        default: 0
    },
    totalCodingScore: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Ongoing', 'Submitted', 'Suspended'],
        default: 'Submitted'
    },
    verdict: {
        type: String,
        enum: ['Pass', 'Fail'],
        default: 'Fail'
    },
    suspensionReason: {
        type: String,
        default: ''
    },
    liveSnapshot: {
        type: String,
        default: ''
    },
    micActivity: {
        type: Number,
        default: 0
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure unique result per user per exam
resultSchema.index({ userId: 1, examId: 1 }, { unique: true });
resultSchema.index({ isPublished: 1 });
resultSchema.index({ status: 1 });
resultSchema.index({ attendance: 1 });
resultSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Result', resultSchema);
