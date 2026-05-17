const CertificateTemplate = require('../models/CertificateTemplate');
const Result = require('../models/Result');
const path = require('path');

/**
 * Save or update a certificate template configuration
 */
exports.saveTemplate = async (req, res) => {
    try {
        const { eventId, backgroundImage, fields, canvasWidth, canvasHeight, examId } = req.body;

        let template = await CertificateTemplate.findOne({ eventId });

        if (template) {
            template.backgroundImage = backgroundImage;
            template.fields = fields;
            template.canvasWidth = canvasWidth;
            template.canvasHeight = canvasHeight;
            template.examId = examId;
            await template.save();
        } else {
            template = await CertificateTemplate.create({
                eventId,
                examId,
                backgroundImage,
                fields,
                canvasWidth,
                canvasHeight
            });
        }

        res.status(200).json({ success: true, data: template });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get template for an event
 */
exports.getTemplate = async (req, res) => {
    try {
        const template = await CertificateTemplate.findOne({ eventId: req.params.eventId });
        res.status(200).json({ success: true, data: template });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
