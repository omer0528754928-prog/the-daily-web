const express = require('express');
const feedFilters = require('../../middleware/feedFilters');
const pagination = require('../../middleware/pagination');
const feedController = require('../../controllers/api/feedController');

const router = express.Router();

// GET /api/feed : same filters as the home page, plus limit/skip for the next batch
router.get('/', feedFilters, pagination, feedController.listFeed);

module.exports = router;
