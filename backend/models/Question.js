const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionText: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['MCQ', 'TrueFalse', 'Coding'],
        required: true
    },
    marks: {
        type: Number,
        required: true,
        default: 1,
        min: 0
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
    },
    // For MCQ/TrueFalse
    options: [String], 
    correctAnswer: String,
    
    // For Coding Questions (HIGH PRIORITY)
    codingMetadata: {
        problemDescription: String,
        inputDescription: mongoose.Schema.Types.Mixed,
        outputDescription: mongoose.Schema.Types.Mixed,
        constraints: mongoose.Schema.Types.Mixed,
        sampleInput: String,
        sampleOutput: String,
        examples: [
            {
                input: String,
                output: String,
                explanation: String
            }
        ],
        testCases: [
            {
                input: String,
                expectedOutput: String,
                isVisible: { type: Boolean, default: false } // Distinguished between Sample(Visible) and Hidden
            }
        ],
        supportedLanguages: {
            type: [String],
            default: ['c', 'cpp', 'java', 'python', 'javascript']
        },
        starterCode: {
            python: { type: String, default: '' },
            java: { type: String, default: '' },
            cpp: { type: String, default: '' },
            c: { type: String, default: '' },
            javascript: { type: String, default: '' }
        }
    },
    
    images: [
        {
            url: String,
            purpose: String,
            scale: { type: Number, default: 100 }
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Question', questionSchema);
