const express = require('express');
const loadPublicArticle = require('../../middleware/loadPublicArticle');
const pagination = require('../../middleware/pagination');
const commentRateLimit = require('../../middleware/commentRateLimit');
const articleCommentsController = require('../../controllers/api/articleCommentsController');

const router = express.Router();

// Open to guests, like the article page. loadPublicArticle answers 404 for a bad id or an
// article that is not public (as JSON, because the URL starts with /api).
router.get('/:id/comments', loadPublicArticle, pagination, articleCommentsController.listComments);
// The same limiter as the form (routes/articleRoutes.js), so both count toward the same 3 a minute
router.post('/:id/comments', loadPublicArticle, commentRateLimit, articleCommentsController.createComment);

module.exports = router;
