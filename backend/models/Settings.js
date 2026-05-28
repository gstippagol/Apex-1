const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    isRegistrationOpen: {
        type: Boolean,
        default: true
    },
    isEmailEnabled: {
        type: Boolean,
        default: true
    },
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Settings', settingsSchema);
