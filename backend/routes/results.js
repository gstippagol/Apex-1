const express = require('express');
const { 
    submitExam, 
    getUserResults, 
    getResultsByExam, 
    publishResults,
    getResultById,
    getAllResults,
    deleteResult,
    startExam,
    getActiveSessions,
    suspendResult,
    updateSession
} = require('../controllers/resultController');
const { analyzeExamPlagiarism } = require('../controllers/plagiarismController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/', submitExam);
router.post('/start', startExam);
router.patch('/:id/session', updateSession);
router.get('/my-results', getUserResults);
router.get('/all', authorize('admin', 'superadmin'), getAllResults);
router.get('/active', authorize('admin', 'superadmin'), getActiveSessions);
router.get('/:id', getResultById);

// Admin only routes
router.get('/exam/:examId', authorize('admin', 'superadmin'), getResultsByExam);
router.patch('/publish/:examId', authorize('admin', 'superadmin'), publishResults);
router.patch('/:id/toggle-publish', authorize('admin', 'superadmin'), require('../controllers/resultController').toggleIndividualPublish);
router.patch('/:id/toggle-attendance', authorize('admin', 'superadmin'), require('../controllers/resultController').toggleAttendance);
router.patch('/:id/suspend', authorize('admin', 'superadmin'), suspendResult);
router.get('/plagiarism/:examId', authorize('admin', 'superadmin'), analyzeExamPlagiarism);
router.delete('/:id', authorize('admin', 'superadmin'), deleteResult);

module.exports = router;
