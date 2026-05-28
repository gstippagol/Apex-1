const express = require('express');
const { 
    submitFeedback, 
    getAllFeedback, 
    deleteFeedback 
} = require('../controllers/feedbackController');
const { protect, authorize } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Optional auth helper to link submissions to users if they are logged in
const optionalProtect = async (req, res, next) => {
    let token;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id);
        } catch (err) {
            // Suppress error so request proceeds as guest
        }
    }
    next();
};

// Public route to submit feedback
router.post('/', optionalProtect, submitFeedback);

// Administrative routes protected strictly for admin/superadmin
router.get('/', protect, authorize('admin', 'superadmin'), getAllFeedback);
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteFeedback);

module.exports = router;
