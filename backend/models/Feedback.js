const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide your email address'],
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email address'
        ]
    },
    usn: {
        type: String,
        required: false,
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Please select a feedback category'],
        enum: ['Exams', 'Website', 'Apex Club', 'General']
    },
    message: {
        type: String,
        required: [true, 'Please provide feedback content'],
        maxlength: [2000, 'Feedback content cannot exceed 2000 characters']
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 604800 // Auto-delete after 7 days (604800 seconds)
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Feedback', FeedbackSchema);
