const express = require('express');
const loadPublicArticle = require('../middleware/loadPublicArticle');
const articleController = require('../controllers/articleController');

const router = express.Router();

// Open to everyone: guests read articles and comment without logging in
router.get('/:id', loadPublicArticle, articleController.showArticle);
// loadPublicArticle runs here too, so comments can only be added to a public article
router.post('/:id/comments', loadPublicArticle, articleController.addComment);

module.exports = router;
