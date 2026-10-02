const express = require('express');
const reporterArticlesRoutes = require('./reporterArticlesRoutes');
const articleCommentsRoutes = require('./articleCommentsRoutes');

const router = express.Router();

router.use('/reporter/articles', reporterArticlesRoutes);
router.use('/articles', articleCommentsRoutes);

module.exports = router;
