const express = require('express');
const requireRole = require('../middleware/requireRole');
const { ROLES } = require('../models/User');
const reporterController = require('../controllers/reporterController');

const router = express.Router();

router.use(requireRole(ROLES.REPORTER));

router.get('/', reporterController.showDashboard);
router.get('/articles/new', reporterController.showNewArticleForm);
router.get('/articles/:id', reporterController.showArticle);
router.get('/articles/:id/edit', reporterController.showEditArticleForm);

module.exports = router;
