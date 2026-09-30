const express = require('express');
const feedFilters=require('../middleware/feedFilters')
const homePageController = require('../controllers/homePageController');

const router = express.Router();

router.get('/',feedFilters, homePageController.showHome);
router.get('/weather-widget', homePageController.weatherWidget);

module.exports = router;
