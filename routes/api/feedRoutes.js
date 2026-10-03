const express = require('express');
const feedFilters = require('../../middleware/feedFilters');
const pagination = require('../../middleware/pagination');
const feedController = require('../../controllers/api/feedController');

const router = express.Router();

router.get('/', feedFilters, pagination, feedController.listFeed);

module.exports = router;
