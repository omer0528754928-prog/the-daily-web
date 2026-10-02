const express = require('express');
const requireRole = require('../middleware/requireRole');
const loadOwnArticle = require('../middleware/loadOwnArticle');
const requireEditable = require('../middleware/requireEditable');
const parseForm = require('../middleware/parseForm');
const articleFilters = require('../middleware/articleFilters');
const { paginationByPage } = require('../middleware/pagination');
const { ROLES } = require('../models/User');
const reporterController = require('../controllers/reporterController');

const router = express.Router();

router.use(requireRole(ROLES.REPORTER, ROLES.EDITOR));

router.get('/', articleFilters, paginationByPage(10), reporterController.showDashboard);

router.get('/articles/new', reporterController.showNewArticleForm);
router.post('/articles', parseForm, reporterController.createArticle);

router.get('/articles/:id', loadOwnArticle, reporterController.showArticle);
router.get('/articles/:id/edit', loadOwnArticle, requireEditable, reporterController.showEditArticleForm);
router.post('/articles/:id', loadOwnArticle, requireEditable, parseForm, reporterController.updateArticle);

module.exports = router;
