const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a title']
    },
    subject: {
        type: String,
        required: [true, 'Please add a subject']
    },
    content: {
        type: String,
        required: [true, 'Please add content']
    },
    image: {
        type: String
    },
    imageScale: {
        type: Number,
        default: 100
    },
    type: {
        type: String,
        enum: ['general', 'urgent', 'exam', 'holiday'],
        default: 'general'
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    targetDepartment: {
        type: String,
        default: 'All'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Notice', noticeSchema);
