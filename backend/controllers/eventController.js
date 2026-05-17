const Event = require('../models/Event');
const { cache, invalidate } = require('../utils/cache');

// GET all events (public – students + admin)
exports.getEvents = async (req, res) => {
    try {
        const events = await cache('events:all', 300, async () => {
            return await Event.find().sort({ startTime: 1 });
        });
        res.status(200).json({ success: true, data: events });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST create event (admin only)
exports.createEvent = async (req, res) => {
    try {
        const event = await Event.create({ ...req.body, createdBy: req.user.id });
        await invalidate('events:all');
        
        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'event', action: 'create' });

        res.status(201).json({ success: true, data: event });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// PATCH update status (admin only): Upcoming | Completed | Postponed | Cancelled
exports.updateEventStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ['Upcoming', 'Completed', 'Postponed', 'Cancelled'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }
        const event = await Event.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        await invalidate('events:all');

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'event', action: 'status-update' });

        res.status(200).json({ success: true, data: event });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// PUT update event (admin only)
exports.updateEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        await invalidate('events:all');

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'event', action: 'update' });

        res.status(200).json({ success: true, data: event });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// DELETE event (admin only)
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        await event.deleteOne();
        await invalidate('events:all');

        const io = req.app.get('io');
        if (io) io.emit('data-updated', { type: 'event', action: 'delete' });

        res.status(200).json({ success: true, message: 'Event deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
