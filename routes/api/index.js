const express = require('express');
const reporterArticlesRoutes = require('./reporterArticlesRoutes');
const usersRoutes = require('./usersRoutes');

const router = express.Router();

router.use('/reporter/articles', reporterArticlesRoutes);
router.use('/users', usersRoutes);

module.exports = router;
