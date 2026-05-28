const Settings = require('../models/Settings');

// @desc    Get global settings
// @route   GET /api/settings
// @access  Public
exports.getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            // Create default settings if not exists
            settings = await Settings.create({ isRegistrationOpen: true, isEmailEnabled: true });
        }
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update global settings
// @route   PUT /api/settings
// @access  Private/Admin
exports.updateSettings = async (req, res) => {
    try {
        const { isRegistrationOpen, isEmailEnabled } = req.body;
        
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }
        
        if (isRegistrationOpen !== undefined) settings.isRegistrationOpen = isRegistrationOpen;
        if (isEmailEnabled !== undefined) settings.isEmailEnabled = isEmailEnabled;
        settings.lastUpdatedBy = req.user.id;
        settings.updatedAt = Date.now();
        
        await settings.save();
        
        // Emit socket update
        const io = req.app.get('io');
        if (io) io.emit('settings-updated', settings);

        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
