const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const { cache, invalidate } = require('../utils/cache');

exports.createExam = async (req, res) => {
    try {
        req.body.createdBy = req.user.id;
        const exam = await Exam.create(req.body);
        await invalidate('exams:*');
        
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'exam', action: 'create' });

        res.status(201).json({ success: true, data: exam });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getExams = async (req, res) => {
    try {
        const cacheKey = `exams:${req.user.role}:${req.user.department || 'All'}`;
        const exams = await cache(cacheKey, 60, async () => {
            let query;
            if (req.user.role === 'admin' || req.user.role === 'superadmin') {
                query = Exam.find().populate('createdBy', 'name').populate('questions', 'marks').sort({ createdAt: -1 });
            } else {
                query = Exam.find({ 
                    status: { $in: ['Published', 'Ongoing', 'Stopped'] },
                    $or: [
                        { targetDepartments: { $in: ['All', req.user.department] } },
                        { targetDepartments: { $exists: false } },
                        { targetDepartments: { $size: 0 } }
                    ]
                }).populate('createdBy', 'name').populate('questions', 'marks').sort({ createdAt: -1 });
            }
            return await query;
        });

        res.status(200).json({ success: true, data: exams });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id).populate('questions');
        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }
        
        // Filter out any questions that might have been deleted but are still referenced
        exam.questions = exam.questions.filter(q => q !== null);
        
        res.status(200).json({ success: true, data: exam });
    } catch (err) {
        res.status(400).json({ success: false, message: 'Invalid or missing Exam ID' });
    }
};

exports.updateExam = async (req, res) => {
    try {
        let exam = await Exam.findById(req.params.id);
        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Restriction: No editing if Ongoing or Published
        if (exam.status === 'Ongoing' || exam.status === 'Published') {
            return res.status(400).json({ success: false, message: 'Cannot edit an ongoing or published exam' });
        }

        exam = await Exam.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        await invalidate('exams:*');

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'exam', action: 'update' });

        res.status(200).json({ success: true, data: exam });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.publishExam = async (req, res) => {
    try {
        const { targetDepartments } = req.body;
        const updateData = { status: 'Published' };
        if (targetDepartments) updateData.targetDepartments = targetDepartments;
        
        const exam = await Exam.findByIdAndUpdate(req.params.id, updateData, { new: true });
        await invalidate('exams:*');

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'exam', action: 'publish' });

        res.status(200).json({ success: true, data: exam });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.stopExam = async (req, res) => {
    try {
        const exam = await Exam.findByIdAndUpdate(req.params.id, { status: 'Stopped' }, { new: true });
        // In a real app, you'd trigger a socket event to auto-submit all student exams here
        await invalidate('exams:*');

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'exam', action: 'stop' });

        res.status(200).json({ success: true, data: exam });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.restartExam = async (req, res) => {
    try {
        const exam = await Exam.findByIdAndUpdate(req.params.id, { status: 'Ongoing' }, { new: true });
        await invalidate('exams:*');

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'exam', action: 'restart' });

        res.status(200).json({ success: true, message: 'Exam session reactivated', data: exam });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Restriction: No delete if Ongoing or Published
        if (exam.status === 'Ongoing' || exam.status === 'Published') {
            return res.status(400).json({ success: false, message: 'Cannot delete an ongoing or published exam' });
        }

        // Delete all associated questions
        await Question.deleteMany({ _id: { $in: exam.questions } });
        
        // Cascade delete: Remove all student results associated with this exam
        await Result.deleteMany({ examId: req.params.id });
        
        await exam.deleteOne();
        await invalidate('exams:*');

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'exam', action: 'delete' });

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.withdrawExam = async (req, res) => {
    try {
        const exam = await Exam.findByIdAndUpdate(req.params.id, { status: 'Withdrawn' }, { new: true });
        
        // Delete all student results associated with this exam when withdrawn
        await Result.deleteMany({ examId: req.params.id });

        await invalidate('exams:*');

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'exam', action: 'withdraw' });

        res.status(200).json({ success: true, message: 'Exam withdrawn from student view', data: exam });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
