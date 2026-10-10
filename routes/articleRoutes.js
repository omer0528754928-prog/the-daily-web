const express = require('express');
const loadPublicArticle = require('../middleware/loadPublicArticle');
const commentRateLimit = require('../middleware/commentRateLimit');
const articleController = require('../controllers/articleController');

const router = express.Router();

// Open to everyone: guests read articles and comment without logging in
router.get('/:id', loadPublicArticle, articleController.showArticle);
// loadPublicArticle runs here too, so comments can only be added to a public article.
// It runs before the limit, so a request for a missing article never counts.
router.post('/:id/comments', loadPublicArticle, commentRateLimit, articleController.addComment);

module.exports = router;
