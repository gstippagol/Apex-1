const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    description: { type: String, default: '' },
    instructor: { type: String, default: '' },
    totalQuestions: { type: Number, default: 0 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    // Admin-managed lifecycle status
    status: {
        type: String,
        enum: ['Upcoming', 'Completed', 'Postponed', 'Cancelled'],
        default: 'Upcoming'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', eventSchema);
