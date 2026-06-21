const Notice = require('../models/Notice');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// @desc    Get all notices
// @route   GET /api/notices
// @access  Private
exports.getNotices = async (req, res) => {
    try {
        const notices = await Notice.find().sort({ createdAt: -1 }).populate('createdBy', 'name');
        res.status(200).json({ success: true, count: notices.length, data: notices });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.createNotice = async (req, res) => {
    try {
        req.body.createdBy = req.user.id;
        const notice = await Notice.create(req.body);

        // Emit socket event for real-time notification
        const io = req.app.get('io');
        if (io) {
            io.emit('broadcast-notice', {
                title: notice.title,
                content: notice.content,
                type: notice.type
            });
            io.emit('data-updated', { type: 'notice', action: 'create' });
        }

        // --- Email Notification Logic ---
        // Fetch all active users (students and admins)
        const users = await User.find({ isEliminated: false, isActive: true }).select('email');
        const emailList = users.map(u => u.email);

        if (emailList.length > 0) {
            try {
                const platformUrl = process.env.FRONTEND_URL || 'https://apexclub-muse.netlify.app';
                await sendEmail({
                    bcc: emailList, // Use BCC to hide emails from other recipients
                    subject: `[OFFICIAL CIRCULAR] ${notice.title}`,
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 40px 30px; border-radius: 24px; margin-bottom: 30px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
                                <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">Official Circular</h1>
                                <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 600; text-transform: uppercase; tracking: 0.1em; font-size: 14px;">-- APEX CLUB --</p>
                            </div>
                            
                            <div style="padding: 0 10px;">
                                <h2 style="color: #0f172a; font-size: 22px; margin-top: 0; font-weight: 700;">${notice.title}</h2>
                                <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
                                    <p style="white-space: pre-wrap; font-size: 16px; margin: 0; color: #334155;">${notice.content}</p>
                                </div>
                                
                                <table border="0" cellpadding="0" cellspacing="0" style="margin: 40px auto 0 auto; text-align: center;">
                                    <tr>
                                        <td align="center" bgcolor="#3b82f6" style="border-radius: 16px;">
                                            <a href="${platformUrl}" 
                                               target="_blank"
                                               style="font-size: 16px; font-family: sans-serif; color: #ffffff; text-decoration: none; border-radius: 16px; padding: 16px 32px; border: 1px solid #3b82f6; display: inline-block; font-weight: 700; background-color: #3b82f6; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5);">
                                                Visit Platform
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            
                            <div style="margin-top: 50px; padding: 30px 10px 0; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; text-align: center;">
                                <p style="margin-bottom: 5px;">You are receiving this official communication as a registered member of APEX Club.</p>
                                <p style="margin-top: 0; font-weight: 600;">© 2026 APEX Club | The Peak of success</p>
                            </div>
                        </div>
                    `
                });
            } catch (emailErr) {
                console.error('Email Broadcast Failed:', emailErr);
            }
        }

        res.status(201).json({ success: true, data: notice });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete a notice
// @route   DELETE /api/notices/:id
// @access  Private/Admin
exports.deleteNotice = async (req, res) => {
    try {
        const notice = await Notice.findByIdAndDelete(req.params.id);
        if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });

        // Emit socket event
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'notice', action: 'delete' });

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
