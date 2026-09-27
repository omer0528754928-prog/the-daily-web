const express = require('express');
const homePageController = require('../controllers/homePageController');

const router = express.Router();

router.get('/', homePageController.showHome);
router.get('/weather-widget', homePageController.weatherWidget);

if (process.env.NODE_ENV !== 'production') {
  router.get('/dev/weather', homePageController.setDevWeather);
}

module.exports = router;
