const mongoose = require('mongoose');

const CertificateTemplateSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam'
    },
    backgroundImage: {
        type: String,
        required: true
    },
    fields: {
        name: { x: Number, y: Number, fontSize: Number, color: String, fontWeight: String },
        usn: { x: Number, y: Number, fontSize: Number, color: String, fontWeight: String },
        rank: { x: Number, y: Number, fontSize: Number, color: String, fontWeight: String },
        score: { x: Number, y: Number, fontSize: Number, color: String, fontWeight: String },
        date: { x: Number, y: Number, fontSize: Number, color: String, fontWeight: String },
        title: { x: Number, y: Number, fontSize: Number, color: String, fontWeight: String }
    },
    canvasWidth: Number,
    canvasHeight: Number,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('CertificateTemplate', CertificateTemplateSchema);
