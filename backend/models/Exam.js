const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
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
    startTime: {
        type: String,
        required: false
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
    proctoring: {
        camera: { type: Boolean, default: true },
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

// Indexes for performance
examSchema.index({ status: 1 });
examSchema.index({ scheduledDate: 1 });
examSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Exam', examSchema);
