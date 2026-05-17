const express = require('express');
const router = express.Router();
const { 
    createQuiz, 
    getQuizzes, 
    getQuiz, 
    updateQuiz, 
    deleteQuiz, 
    submitQuiz,
    getQuizResults,
    publishQuiz,
    stopQuiz,
    withdrawQuiz,
    restartQuiz,
    deleteQuizResult
} = require('../controllers/quizController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(getQuizzes)
    .post(authorize('admin', 'superadmin'), createQuiz);

router.route('/results')
    .get(getQuizResults);

router.route('/results/:id')
    .delete(authorize('admin', 'superadmin'), deleteQuizResult);

router.route('/:id')
    .get(getQuiz)
    .put(authorize('admin', 'superadmin'), updateQuiz)
    .delete(authorize('admin', 'superadmin'), deleteQuiz);

router.patch('/:id/publish', authorize('admin', 'superadmin'), publishQuiz);
router.patch('/:id/stop', authorize('admin', 'superadmin'), stopQuiz);
router.patch('/:id/withdraw', authorize('admin', 'superadmin'), withdrawQuiz);
router.patch('/:id/restart', authorize('admin', 'superadmin'), restartQuiz);

router.post('/submit', submitQuiz);

module.exports = router;
