const express = require('express');
const requireRole = require('../../middleware/requireRole');
const pagination = require('../../middleware/pagination');
const { ROLES } = require('../../models/User');
const reporterArticlesController = require('../../controllers/api/reporterArticlesController');

const router = express.Router();

router.use(requireRole(ROLES.REPORTER));

router.get('/', pagination, reporterArticlesController.listMyArticles);

module.exports = router;
