const Feedback = require('../models/Feedback');

// @desc    Submit new feedback
// @route   POST /api/feedback
// @access  Public (Authenticated or Guest)
exports.submitFeedback = async (req, res) => {
    try {
        const { name, email, usn, category, message } = req.body;

        // Construct feedback payload
        const feedbackData = {
            name,
            email,
            usn,
            category,
            message
        };

        // If user is authenticated, attach user ID
        if (req.user && req.user.id) {
            feedbackData.userId = req.user.id;
            if (!feedbackData.usn && req.user.usn) {
                feedbackData.usn = req.user.usn;
            }
        }

        const feedback = await Feedback.create(feedbackData);

        // Real-time notify admins via socket if active
        const io = req.app.get('io');
        if (io) {
            io.emit('data-updated', { type: 'feedback', action: 'create', data: feedback });
        }

        res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully. Thank you for your contribution!',
            data: feedback
        });
    } catch (err) {
        console.error('Feedback Submission Error:', err);
        res.status(400).json({
            success: false,
            message: err.message || 'Failed to submit feedback.'
        });
    }
};

// @desc    Get all feedback submissions
// @route   GET /api/feedback
// @access  Private/Admin
exports.getAllFeedback = async (req, res) => {
    try {
        const feedbacks = await Feedback.find()
            .populate('userId', 'name email usn department role')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: feedbacks.length,
            data: feedbacks
        });
    } catch (err) {
        console.error('Fetch Feedback Error:', err);
        res.status(400).json({
            success: false,
            message: err.message || 'Failed to retrieve feedback submissions.'
        });
    }
};

// @desc    Delete a feedback submission
// @route   DELETE /api/feedback/:id
// @access  Private/Admin
exports.deleteFeedback = async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback submission not found'
            });
        }

        await feedback.deleteOne();

        const io = req.app.get('io');
        if (io) {
            io.emit('data-updated', { type: 'feedback', action: 'delete' });
        }

        res.status(200).json({
            success: true,
            message: 'Feedback submission deleted successfully.'
        });
    } catch (err) {
        console.error('Delete Feedback Error:', err);
        res.status(400).json({
            success: false,
            message: err.message || 'Failed to delete feedback submission.'
        });
    }
};
