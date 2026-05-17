const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User no longer exists' });
        }

        // Single Session Enforcement: Check if sessionId matches
        if (decoded.sessionId && req.user.activeSessionId !== decoded.sessionId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Multiple logins detected. This session has been terminated.',
                isSessionExpired: true 
            });
        }

        // Account Lockdown check
        if (!req.user.isActive) {
            return res.status(403).json({ success: false, message: 'Account deactivated by administrative protocol' });
        }

        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};
