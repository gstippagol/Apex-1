const express = require('express');
const { saveTemplate, getTemplate } = require('../controllers/certificateController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/:eventId', getTemplate);
router.post('/', authorize('admin', 'superadmin'), saveTemplate);

module.exports = router;
