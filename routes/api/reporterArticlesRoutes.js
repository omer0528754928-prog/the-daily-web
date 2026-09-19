const express = require('express');
const requireRole = require('../../middleware/requireRole');
const pagination = require('../../middleware/pagination');
const loadOwnArticle = require('../../middleware/loadOwnArticle');
const requireEditable = require('../../middleware/requireEditable');
const parseForm = require('../../middleware/parseForm');
const articleFilters = require('../../middleware/articleFilters');
const { ROLES } = require('../../models/User');
const reporterArticlesController = require('../../controllers/api/reporterArticlesController');

const router = express.Router();

router.use(requireRole(ROLES.REPORTER));

router.get('/', articleFilters, pagination, reporterArticlesController.listMyArticles);
router.post('/', parseForm, reporterArticlesController.createArticle);

router.get('/:id', loadOwnArticle, reporterArticlesController.getArticle);
router.patch('/:id', loadOwnArticle, requireEditable, parseForm, reporterArticlesController.updateArticle);
router.post('/:id/submit', loadOwnArticle, requireEditable, reporterArticlesController.submitArticle);

module.exports = router;
