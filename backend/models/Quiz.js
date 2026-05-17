const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    duration: {
        type: Number,
        required: true // In seconds
    },
    passingMarks: {
        type: Number,
        default: 0
    },
    scheduledDate: {
        type: String,
        required: false
    },
    isRestricted: {
        type: Boolean,
        default: false
    },
    fullscreenOnly: {
        type: Boolean,
        default: false
    },
    questions: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question'
        }
    ],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Ongoing', 'Stopped', 'Completed', 'Withdrawn'],
        default: 'Draft'
    },
    // Quiz specifically has no proctoring
    proctoring: {
        camera: { type: Boolean, default: false },
        microphone: { type: Boolean, default: false }
    },
    targetDepartments: {
        type: [String],
        default: ['All']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

quizSchema.index({ status: 1 });
quizSchema.index({ scheduledDate: 1 });
quizSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Quiz', quizSchema);
