const express = require('express');
const feedFilters=require('../middleware/feedFilters')
const homePageController = require('../controllers/homePageController');

const router = express.Router();

router.get('/',feedFilters, homePageController.showHome);
// HTML fragments of the weather widgets, fetched by public/js/weather.js to refresh them
router.get('/weather-widget', homePageController.weatherWidget);
router.get('/weather-widget/small', homePageController.weatherWidgetSmall);

module.exports = router;
