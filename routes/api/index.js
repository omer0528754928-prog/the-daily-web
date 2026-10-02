const express = require('express');
const reporterArticlesRoutes = require('./reporterArticlesRoutes');
const articleCommentsRoutes = require('./articleCommentsRoutes');
const usersRoutes = require('./usersRoutes');

const router = express.Router();

router.use('/reporter/articles', reporterArticlesRoutes);
router.use('/articles', articleCommentsRoutes);
router.use('/users', usersRoutes);

module.exports = router;
