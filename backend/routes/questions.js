const express = require('express');
const { 
    getQuestions, 
    createQuestion, 
    getAllQuestions,
    updateQuestion,
    deleteQuestion
} = require('../controllers/questionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getQuestions)
    .post(authorize('admin', 'superadmin'), createQuestion);

router.get('/all', authorize('admin', 'superadmin'), getAllQuestions);

router.route('/:id')
    .put(authorize('admin', 'superadmin'), updateQuestion)
    .delete(authorize('admin', 'superadmin'), deleteQuestion);

module.exports = router;
