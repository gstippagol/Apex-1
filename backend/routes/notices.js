const express = require('express');
const { getNotices, createNotice, deleteNotice } = require('../controllers/noticeController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getNotices);
router.post('/', authorize('admin', 'superadmin'), createNotice);
router.delete('/:id', authorize('admin', 'superadmin'), deleteNotice);

module.exports = router;
