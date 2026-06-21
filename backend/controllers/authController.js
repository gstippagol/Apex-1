const User = require('../models/User');
const OTP = require('../models/OTP');
const Settings = require('../models/Settings');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// @desc    Send OTP to email
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOTP = async (req, res) => {
    try {
        // Check if registration is allowed
        const settings = await Settings.findOne();
        if (settings && !settings.isRegistrationOpen) {
            return res.status(403).json({ success: false, message: 'Registration protocol is currently offline. Please contact administrator.' });
        }

        if (settings && settings.isEmailEnabled === false) {
            return res.status(403).json({ success: false, message: 'Email verification services are currently offline. Please contact administrator.' });
        }

        const { email, name, usn, mobileNumber } = req.body;

        const emailDomain = email.split('@')[1]?.toLowerCase() || '';
        const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'live.com', 'msn.com', 'ymail.com', 'googlemail.com', 'apex.com'];
        const isEduDomain = emailDomain.endsWith('.edu') || emailDomain.endsWith('.edu.in') || emailDomain.endsWith('.ac.in');
        
        if (!allowedDomains.includes(emailDomain) && !isEduDomain) {
            return res.status(400).json({ success: false, message: 'Please use a valid institution or primary email provider. Temporary emails are blocked.' });
        }

        // Check for duplicates before sending OTP
        const existingEmail = await User.findOne({ email });
        if (existingEmail) return res.status(400).json({ success: false, message: 'Email already catalogued' });
        
        const existingUSN = await User.findOne({ usn });
        if (existingUSN) return res.status(400).json({ success: false, message: 'USN already catalogued' });

        const existingMobile = await User.findOne({ mobileNumber });
        if (existingMobile) return res.status(400).json({ success: false, message: 'Mobile number already catalogued' });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to DB
        await OTP.findOneAndUpdate(
            { email },
            { otp, createdAt: new Date() },
            { upsert: true, new: true }
        );

        // Check for Email Configuration
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('CRITICAL: SMTP Credentials missing from .env configuration');
            return res.status(500).json({ 
                success: false, 
                message: 'System Email Protocol not configured. Please contact administrator to set EMAIL_USER and EMAIL_PASS.' 
            });
        }

        // Send Email
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: `"APEX Platform" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'APEX Registry - Identity Verification Code',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2563eb; text-align: center;">APEX Identity Verification</h2>
                    <p>Hello <strong>${name}</strong>,</p>
                    <p>To finalize your academic portal registry, please use the following one-time authentication code:</p>
                    <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: 900; letter-spacing: 10px; color: #1e293b;">${otp}</span>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center;">This code will expire in 5 minutes. If you did not request this, please ignore this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ success: true, message: 'Verification code dispatched to email' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Verify OTP and Register user
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
    try {
        // Check if registration is allowed
        const settings = await Settings.findOne();
        if (settings && !settings.isRegistrationOpen) {
            return res.status(403).json({ success: false, message: 'Registration protocol is currently offline. Please contact administrator.' });
        }

        const { name, email, password, role, department, usn, mobileNumber, otp } = req.body;

        if (!password || password.length < 10 || password.length > 16 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be 10-16 characters with at least one uppercase letter, one lowercase letter, and one special character.' 
            });
        }

        // Role Restriction: Self-registered users can only be registered as students
        if (role && role !== 'student') {
            return res.status(403).json({ success: false, message: 'Authorization Failure: Self-registered accounts are restricted to student roles' });
        }

        // Verify OTP
        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
        }

        // Delete OTP record
        await OTP.deleteOne({ _id: otpRecord._id });

        // Proceed to registration
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'student',
            department,
            usn,
            mobileNumber
        });

        // Emit Socket Update
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'user', action: 'register' });

        await sendTokenResponse(user, 201, res, req);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const emailDomain = email.split('@')[1]?.toLowerCase() || '';
        const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'live.com', 'msn.com', 'ymail.com', 'googlemail.com', 'apex.com'];
        const isEduDomain = emailDomain.endsWith('.edu') || emailDomain.endsWith('.edu.in') || emailDomain.endsWith('.ac.in');
        
        if (!allowedDomains.includes(emailDomain) && !isEduDomain) {
            return res.status(400).json({ success: false, message: 'Please use a valid institution or primary email provider. Temporary emails are blocked.' });
        }

        const settings = await Settings.findOne();
        if (settings && settings.isEmailEnabled === false) {
            return res.status(403).json({ success: false, message: 'Email recovery services are currently offline. Please contact administrator.' });
        }

        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Identity not found in protocol' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to DB
        await OTP.findOneAndUpdate(
            { email },
            { otp, createdAt: new Date() },
            { upsert: true, new: true }
        );

        // Send Email
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: `"APEX Platform" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'APEX Registry - Password Recovery Protocol',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #e11d48; text-align: center;">Identity Recovery Protocol</h2>
                    <p>You have requested a password reset for your APEX account.</p>
                    <p>Please use the following recovery code to reset your access credentials:</p>
                    <div style="background: #fff1f2; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: 900; letter-spacing: 10px; color: #be123c;">${otp}</span>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center;">This code will expire in 5 minutes. If you did not request this, please secure your account immediately.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ success: true, message: 'Recovery code dispatched to email' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!newPassword || newPassword.length < 10 || newPassword.length > 16 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be 10-16 characters with at least one uppercase letter, one lowercase letter, and one special character.' 
            });
        }

        // Verify OTP
        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid or expired recovery code' });
        }

        // Update User Password
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.password = newPassword;
        
        // Record Activity
        user.webActivity.unshift({
            action: 'Password Recovery',
            details: 'Credentials reset via email verification'
        });
        
        await user.save();
        await OTP.deleteOne({ _id: otpRecord._id });

        res.status(200).json({ success: true, message: 'Access credentials updated successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Register user (Legacy or Admin bypass)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { name, email, password, role, department, usn, mobileNumber } = req.body;

        if (!password || password.length < 10 || password.length > 16 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be 10-16 characters with at least one uppercase letter, one lowercase letter, and one special character.' 
            });
        }

        const emailDomain = email.split('@')[1]?.toLowerCase() || '';
        const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'live.com', 'msn.com', 'ymail.com', 'googlemail.com', 'apex.com'];
        const isEduDomain = emailDomain.endsWith('.edu') || emailDomain.endsWith('.edu.in') || emailDomain.endsWith('.ac.in');
        
        if (!allowedDomains.includes(emailDomain) && !isEduDomain) {
            return res.status(400).json({ success: false, message: 'Please use a valid institution or primary email provider. Temporary emails are blocked.' });
        }

        // Check if registration is allowed (Only for self-registration, bypass for admins)
        const settings = await Settings.findOne();
        const isRegistrationOpen = settings ? settings.isRegistrationOpen : true;

        // Check requester identity and role
        let requesterRole = 'guest';
        let requesterId = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const requester = await User.findById(decoded.id);
                if (requester) {
                    requesterRole = requester.role;
                    requesterId = requester._id;
                }
            } catch (err) { }
        }

        // Hierarchy Enforcement: Admins cannot create Super Admins
        if (requesterRole === 'admin' && role === 'superadmin') {
            return res.status(403).json({ success: false, message: 'Authorization Failure: Admins cannot provision Super Admin accounts' });
        }

        // Role Restriction: Guests/non-admins cannot register administrative accounts
        if (requesterRole !== 'admin' && requesterRole !== 'superadmin' && role && role !== 'student') {
            return res.status(403).json({ success: false, message: 'Authorization Failure: Guests are only authorized to register as students' });
        }

        // Enforcement: Only admins can register if registration is off
        if (!isRegistrationOpen && requesterRole !== 'admin' && requesterRole !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Registration protocol is currently offline' });
        }

        // Check for duplicates (including eliminated)
        const checkDuplicate = async (query, fieldName) => {
            const existing = await User.findOne(query);
            if (existing) {
                if (existing.isEliminated) {
                    if (requesterRole === 'admin' || requesterRole === 'superadmin') {
                        // Admins can only restore students or other admins, not superadmins
                        if (requesterRole === 'admin' && existing.role === 'superadmin') {
                            return { status: 'denied', message: 'Admins cannot restore Super Admin identities' };
                        }
                        return { status: 'restore', user: existing };
                    } else {
                        return { status: 'eliminated' };
                    }
                }
                return { status: 'exists', field: fieldName };
            }
            return null;
        };

        const dup = (await checkDuplicate({ email }, 'Email')) ||
            (await checkDuplicate({ usn }, 'USN')) ||
            (await checkDuplicate({ mobileNumber }, 'Mobile'));

        if (dup) {
            if (dup.status === 'denied') {
                return res.status(403).json({ success: false, message: dup.message });
            }
            if (dup.status === 'eliminated') {
                return res.status(403).json({ success: false, message: 'This identity has been permanently eliminated from the system. Please contact the administrator.' });
            }
            if (dup.status === 'exists') {
                return res.status(400).json({ success: false, message: `${dup.field} already catalogued in protocol` });
            }
            if (dup.status === 'restore') {
                // Restore logic
                const user = dup.user;
                user.name = name;
                user.email = email;
                user.password = password;
                user.department = department;
                user.usn = usn;
                user.mobileNumber = mobileNumber;
                user.role = role || 'student';
                user.isEliminated = false;
                user.isActive = true;
                await user.save();
                return res.status(200).json({ success: true, data: user, message: 'Member restored from elimination registry' });
            }
        }

        const user = await User.create({
            name,
            email,
            password,
            role,
            department,
            usn,
            mobileNumber
        });

        // Onboarding Email (Only for Manual Registration by Admin/SuperAdmin if email service is active)
        if ((requesterRole === 'admin' || requesterRole === 'superadmin') && (!settings || settings.isEmailEnabled !== false)) {
            try {
                const transporter = nodemailer.createTransport({
                    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                    port: process.env.EMAIL_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                const mailOptions = {
                    from: `"APEX Platform" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'APEX Registry - Identity Provisioning Successful',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 30px; border-radius: 20px;">
                            <h2 style="color: #2563eb; text-align: center;">Welcome to APEX</h2>
                            <p>Hello <strong>${name}</strong>,</p>
                            <p>An administrative authority has provisioned your identity in the APEX Registry. Your access credentials are now active.</p>
                            
                            <div style="background: #f8fafc; padding: 25px; border-radius: 15px; margin: 25px 0; border: 1px solid #e2e8f0;">
                                <h3 style="margin-top: 0; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Access Credentials</h3>
                                <p style="margin: 10px 0;"><strong>Identity Terminal:</strong> ${email}</p>
                                <p style="margin: 10px 0;"><strong>Security Passkey:</strong> <span style="font-family: monospace; background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;">${password}</span></p>
                                
                                <h3 style="margin-top: 20px; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Registry Details</h3>
                                <p style="margin: 10px 0;"><strong>Protocol ID (USN):</strong> ${usn}</p>
                                <p style="margin: 10px 0;"><strong>Department:</strong> ${department}</p>
                                <p style="margin: 10px 0;"><strong>Mobile Mesh:</strong> ${mobileNumber}</p>
                            </div>

                            <table border="0" cellpadding="0" cellspacing="0" style="margin: 35px auto 0 auto; text-align: center;">
                                <tr>
                                    <td align="center" bgcolor="#2563eb" style="border-radius: 12px;">
                                        <a href="${process.env.FRONTEND_URL || 'https://apexclub-muse.netlify.app'}/login" 
                                           target="_blank"
                                           style="font-size: 16px; font-family: sans-serif; color: #ffffff; text-decoration: none; border-radius: 12px; padding: 15px 35px; border: 1px solid #2563eb; display: inline-block; font-weight: bold; background-color: #2563eb; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                                           Access Login Terminal
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 40px; border-top: 1px solid #eee; pt: 20px;">
                                Security Protocol: Please change your passkey upon initial access for maximum security.
                            </p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
            } catch (mailErr) {
                console.error('Onboarding dispatch failed:', mailErr);
            }
        }

        await sendTokenResponse(user, 201, res, req);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const emailDomain = email.split('@')[1]?.toLowerCase() || '';
        const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'live.com', 'msn.com', 'ymail.com', 'googlemail.com', 'apex.com'];
        const isEduDomain = emailDomain.endsWith('.edu') || emailDomain.endsWith('.edu.in') || emailDomain.endsWith('.ac.in');
        
        if (!allowedDomains.includes(emailDomain) && !isEduDomain) {
            return res.status(400).json({ success: false, message: 'Please use a valid institution or primary email provider. Temporary emails are blocked.' });
        }

        const user = await User.findOne({ email }).select('+password');
        console.log(`[DEBUG] Login attempt for: ${email}`);

        if (!user) {
            console.log(`[DEBUG] Login failed: User not found`);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.isEliminated) {
            console.log(`[DEBUG] Login failed: Account eliminated`);
            return res.status(401).json({ success: false, message: 'Account permanently restricted' });
        }

        // Access Control: Block deactivated users
        if (!user.isActive) {
            console.log(`[DEBUG] Login failed: Account deactivated`);
            return res.status(403).json({ success: false, message: 'Your academic portal access has been deactivated by administrator' });
        }

        const isMatch = await user.matchPassword(password);
        console.log(`[DEBUG] Password match: ${isMatch}`);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Record Login History
        user.loginHistory.unshift({
            ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });
        // Keep only last 10 logins
        if (user.loginHistory.length > 10) user.loginHistory.pop();
        await user.save();

        await sendTokenResponse(user, 200, res, req);
    } catch (err) {
        console.error(`[DEBUG] Login error: ${err.message}`);
        res.status(400).json({ success: false, message: err.message });
    }
};

const Result = require('../models/Result');
const Exam = require('../models/Exam');

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
    try {
        // Privacy Logic: Only SuperAdmins can see other SuperAdmins
        let query = { isEliminated: false };
        if (req.user.role !== 'superadmin') {
            query.role = { $ne: 'superadmin' };
        }

        const users = await User.find(query).select('+createdAt');
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get blocked users (Deactivated or Eliminated)
// @route   GET /api/auth/blocked-users
// @access  Private/Admin
exports.getBlockedUsers = async (req, res) => {
    try {
        const users = await User.find({
            $or: [
                { isActive: false },
                { isEliminated: true }
            ]
        }).select('+createdAt');
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get single user details & performance
// @route   GET /api/auth/users/:id
// @access  Private/Admin
exports.getUserDetail = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const results = await Result.find({ userId: req.params.id }).populate('examId', 'title');
        const pastExams = await Exam.find({ status: { $in: ['Completed', 'Stopped'] } });

        // Performance Logic
        const attendedExamIds = results.map(r => r.examId && r.examId._id ? r.examId._id.toString() : null).filter(Boolean);
        const attendedCount = results.length;
        const absentCount = pastExams.filter(exam => !attendedExamIds.includes(exam._id.toString())).length;
        const totalExams = attendedCount + absentCount;

        res.status(200).json({
            success: true,
            data: {
                user,
                results,
                stats: {
                    attended: attendedCount,
                    absent: absentCount,
                    total: totalExams
                }
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update user
// @route   PUT /api/auth/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
    try {
        const { name, email, usn, department, mobileNumber, password } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (name) user.name = name;
        if (email) user.email = email;
        if (usn) user.usn = usn;
        if (department) user.department = department;
        if (mobileNumber) user.mobileNumber = mobileNumber;
        if (password) user.password = password;

        // Hierarchy Check: Admins cannot change roles to Super Admin
        if (req.body.role === 'superadmin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Unauthorized role escalation' });
        }
        if (req.body.role) user.role = req.body.role;

        // Record Activity
        user.webActivity.unshift({
            action: 'Protocol Update',
            details: `Identity modified by ${req.user.name}`
        });
        if (user.webActivity.length > 20) user.webActivity.pop();

        await user.save();

        // Emit Socket Update
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'user', action: 'update' });

        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Toggle user status
// @route   PATCH /api/auth/users/:id/status
// @access  Private/Admin
exports.toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { isActive: !user.isActive },
            { new: true, runValidators: false }
        );

        // Emit Socket Update
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'user', action: 'status-toggle' });

        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Hierarchy Protection
        if (user.role === 'superadmin') {
            return res.status(403).json({ success: false, message: 'Super Admin identities are protected and cannot be eliminated' });
        }

        // Admins can only delete students, not other admins (unless requester is superadmin)
        if (req.user.role === 'admin' && user.role === 'admin') {
            return res.status(403).json({ success: false, message: 'Administrators cannot eliminate other administrative peers' });
        }

        await User.updateOne({ _id: req.params.id }, { isEliminated: true, isActive: false });

        // Record on the target user (though they are eliminated, logs remain)
        // Wait, better to record on the admin who did it?
        // Actually, the requirement is to see the activity of the admin being viewed.
        // So we should record activity on the requester (admin).
        const admin = await User.findById(req.user.id);
        if (admin) {
            admin.webActivity.unshift({
                action: 'Identity Elimination',
                details: `Permanently eliminated ${user.name} (${user.email})`
            });
            if (admin.webActivity.length > 20) admin.webActivity.pop();
            await admin.save();
        }

        await Result.deleteMany({ userId: req.params.id }); // Clean up results

        // Emit Socket Update
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'user', action: 'delete' });

        res.status(200).json({ success: true, message: 'User permanently eliminated from protocol' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Hard delete user
// @route   DELETE /api/auth/users/:id/hard
// @access  Private/Admin
exports.hardDeleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (user.role === 'superadmin') {
            return res.status(403).json({ success: false, message: 'Super Admin identities are protected from purge' });
        }

        if (req.user.role === 'admin' && user.role === 'admin') {
            return res.status(403).json({ success: false, message: 'Administrators cannot purge administrative peers' });
        }

        await User.findByIdAndDelete(req.params.id);
        await Result.deleteMany({ userId: req.params.id });
        res.status(200).json({ success: true, message: 'Identity purged from core database' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Restore eliminated user
// @route   PATCH /api/auth/users/:id/restore
// @access  Private/Admin
exports.restoreUser = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, {
            isEliminated: false,
            isActive: true
        });

        // Emit Socket Update
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'user', action: 'restore' });

        res.status(200).json({ success: true, message: 'User authorization restored' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Get token from model, create cookie and send response
const sendTokenResponse = async (user, statusCode, res, req) => {
    const sessionId = uuidv4();

    // Update activeSessionId in database to invalidate previous sessions
    await User.findByIdAndUpdate(user._id, { activeSessionId: sessionId });

    // Optional: Emit force-logout via socket to the previous session
    const io = req.app.get('io');
    if (io) {
        // We can emit to a room specific to the user ID
        // The first session should have joined a room named `user_${user._id}`
        io.to(`user_${user._id}`).emit('force-logout', {
            message: 'Your account was logged in from another device. This session has been terminated.'
        });
    }

    // Create Access Token (Long lived for seamless experience - 30d)
    // Include sessionId in payload
    const accessToken = jwt.sign({ id: user._id, sessionId }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });

    // Create Refresh Token (Long lived - 7d)
    const refreshToken = jwt.sign({ id: user._id, sessionId }, process.env.JWT_REFRESH_SECRET || 'refresh_secret_99', {
        expiresIn: '7d'
    });

    const options = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    };

    res.status(statusCode)
        .cookie('refreshToken', refreshToken, options)
        .json({
            success: true,
            token: accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                usn: user.usn,
                department: user.department,
                mobileNumber: user.mobileNumber
            }
        });
};

// @desc    Refresh Token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res) => {
    const token = req.cookies.refreshToken;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refresh_secret_99');
        const user = await User.findById(decoded.id);

        if (!user || (decoded.sessionId && user.activeSessionId !== decoded.sessionId)) {
            return res.status(401).json({ success: false, message: 'Session expired due to login on another device' });
        }

        const accessToken = jwt.sign({ id: user._id, sessionId: user.activeSessionId }, process.env.JWT_SECRET, {
            expiresIn: '30d'
        });

        res.status(200).json({
            success: true,
            token: accessToken
        });
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
};

