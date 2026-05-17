const express = require('express');
const { 
    getExams, 
    createExam, 
    getExam, 
    updateExam, 
    deleteExam,
    publishExam,
    stopExam,
    restartExam,
    withdrawExam
} = require('../controllers/examController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getExams)
    .post(authorize('admin', 'superadmin'), createExam);

router.route('/:id')
    .get(getExam)
    .put(authorize('admin', 'superadmin'), updateExam)
    .delete(authorize('admin', 'superadmin'), deleteExam);

router.patch('/:id/publish', authorize('admin', 'superadmin'), publishExam);
router.patch('/:id/stop', authorize('admin', 'superadmin'), stopExam);
router.patch('/:id/restart', authorize('admin', 'superadmin'), restartExam);
router.patch('/:id/withdraw', authorize('admin', 'superadmin'), withdrawExam);

module.exports = router;
