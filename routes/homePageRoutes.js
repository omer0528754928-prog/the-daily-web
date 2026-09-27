const express = require('express');
const homePageController = require('../controllers/homePageController');

const router = express.Router();

router.get('/', homePageController.showHome);

module.exports = router;
