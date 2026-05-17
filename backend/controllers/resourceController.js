const Resource = require('../models/Resource');

exports.getResources = async (req, res) => {
    try {
        const resources = await Resource.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: resources });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.createResource = async (req, res) => {
    try {
        const resource = await Resource.create(req.body);
        res.status(201).json({ success: true, data: resource });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteResource = async (req, res) => {
    try {
        await Resource.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Resource eliminated' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
