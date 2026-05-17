const express = require('express');
const { register, login, getUsers, getUserDetail, updateUser, deleteUser, toggleUserStatus, refreshToken, getBlockedUsers, hardDeleteUser, restoreUser, sendOTP, verifyOTP, forgotPassword, resetPassword } = require('../controllers/authController');
const { bulkRegister } = require('../controllers/bulkController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh', refreshToken);

// Admin only routes
// Admin & SuperAdmin routes
router.get('/users', protect, authorize('admin', 'superadmin'), getUsers);
router.get('/blocked-users', protect, authorize('admin', 'superadmin'), getBlockedUsers);
router.get('/users/:id', protect, authorize('admin', 'superadmin'), getUserDetail);
router.put('/users/:id', protect, authorize('admin', 'superadmin'), updateUser);
router.delete('/users/:id', protect, authorize('admin', 'superadmin'), deleteUser);
router.delete('/users/:id/hard', protect, authorize('admin', 'superadmin'), hardDeleteUser);
router.patch('/users/:id/status', protect, authorize('admin', 'superadmin'), toggleUserStatus);
router.patch('/users/:id/restore', protect, authorize('admin', 'superadmin'), restoreUser);
router.post('/bulk-register', protect, authorize('admin', 'superadmin'), bulkRegister);

module.exports = router;
