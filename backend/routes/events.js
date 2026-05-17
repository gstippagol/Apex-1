const express = require('express');
const { getEvents, createEvent, updateEventStatus, deleteEvent, updateEvent } = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public (authenticated) — all logged-in users can see events
router.get('/', protect, getEvents);

// Admin & SuperAdmin routes
router.post('/', protect, authorize('admin', 'superadmin'), createEvent);
router.patch('/:id/status', protect, authorize('admin', 'superadmin'), updateEventStatus);
router.put('/:id', protect, authorize('admin', 'superadmin'), updateEvent);
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteEvent);

module.exports = router;
