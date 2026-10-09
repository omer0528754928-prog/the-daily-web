const { rateLimit } = require('express-rate-limit');
const { isApiRequest } = require('../utils/HttpError');
const { RATE_LIMITED_MESSAGE } = require('../presenters/commentPresenter');
const articleController = require('../controllers/articleController');

const COMMENTS_PER_MINUTE = 3;

// At most 3 comments a minute from the same device, enforced here on the server.
// "Device" = IP address (the library's default key). A cookie would be easy to delete
// to get a fresh limit, an IP is not. Downside: people sharing one network share the limit.
// One limiter is used by both routes (form and API), so they share the same count.
// The counts are kept in the server's memory (the library's MemoryStore): enough for one
// server, and they start from zero after a restart.
const commentRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: COMMENTS_PER_MINUTE,
  // Only comments that were saved count: a comment rejected by validation (400) or by this
  // limit (429) does not use up the guest's 3
  skipFailedRequests: true,
  // Tells the browser how long to wait (RateLimit and Retry-After headers)
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    if (isApiRequest(req)) {
      // public/js/comments.js shows "messages" next to the form
      return res.status(options.statusCode).json({ error: 'Too many comments', messages: [RATE_LIMITED_MESSAGE] });
    }
    // The form without JavaScript: the article page again, with the message and the typed text
    return articleController.showCommentRateLimited(req, res);
  },
});

module.exports = commentRateLimit;
