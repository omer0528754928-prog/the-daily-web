const express = require('express');
const reporterArticlesRoutes = require('./reporterArticlesRoutes');
const usersRoutes = require('./usersRoutes');
const feedRoutes = require('./feedRoutes');

const router = express.Router();

router.use('/reporter/articles', reporterArticlesRoutes);
router.use('/users', usersRoutes);
router.use('/feed', feedRoutes);

module.exports = router;
