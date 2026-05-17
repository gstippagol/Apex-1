const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['student', 'admin', 'superadmin'],
        default: 'student'
    },
    department: {
        type: String,
        required: [true, 'Please specify your department']
    },
    usn: {
        type: String,
        required: [true, 'Please add a USN'],
        unique: true
    },
    mobileNumber: {
        type: String,
        required: [true, 'Please add a mobile number'],
        match: [
            /^\+91\d{10}$/,
            'Please add a valid mobile number with +91 followed by 10 digits'
        ]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isEliminated: {
        type: Boolean,
        default: false
    },
    loginHistory: [{
        timestamp: { type: Date, default: Date.now },
        ip: String,
        userAgent: String
    }],
    webActivity: [{
        action: String,
        timestamp: { type: Date, default: Date.now },
        details: String
    }],
    activeSessionId: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Encrypt password using bcrypt
userSchema.pre('save', async function() {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
