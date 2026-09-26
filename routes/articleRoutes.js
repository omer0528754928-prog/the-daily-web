const express = require('express');
const loadPublicArticle = require('../middleware/loadPublicArticle');
const articleController = require('../controllers/articleController');

const router = express.Router();

// Open to everyone: guests read articles without logging in
router.get('/:id', loadPublicArticle, articleController.showArticle);

module.exports = router;
