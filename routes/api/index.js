const express = require('express');
const reporterArticlesRoutes = require('./reporterArticlesRoutes');

const router = express.Router();

router.use('/reporter/articles', reporterArticlesRoutes);

module.exports = router;
