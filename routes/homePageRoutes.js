const express = require('express');
const homePageController = require('../controllers/homePageController');

const router = express.Router();

router.get('/', homePageController.showHome);
router.get('/weather-widget', homePageController.weatherWidget);

module.exports = router;
