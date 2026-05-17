const express = require('express');
const { 
    getResources, 
    createResource, 
    deleteResource 
} = require('../controllers/resourceController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getResources)
    .post(authorize('admin', 'superadmin'), createResource);

router.delete('/:id', authorize('admin', 'superadmin'), deleteResource);

module.exports = router;
