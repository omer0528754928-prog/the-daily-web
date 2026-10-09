const publicArticleService = require('../services/publicArticleService');
const commentService = require('../services/commentService');
const weatherService = require('../services/weatherService');
const { toPublicArticle, toRelatedItem } = require('../presenters/publicArticlePresenter');
const { toPublicComment, toCommentProblems, toCommentForm } = require('../presenters/commentPresenter');
const { LIMITS: COMMENT_LIMITS } = require('../validators/commentValidator');
const { ROLES } = require('../models/User');

const COMMENTS_PER_PAGE = 20;

// Loads and renders everything on the article page. The whole article is rendered on the
// server, so its full text is already in the first HTML response (search engines and readers
// without JS see it). Also used to show the page again when the comment form has an error.
async function renderArticlePage(req, res, { status = 200, commentForm = {}, commentErrors = [], rateLimited = false } = {}) {
  const { article } = req;

  const [related, comments, { weather }] = await Promise.all([
    publicArticleService.findRelated(article.liveVersion.category, article._id),
    commentService.listForArticle(article._id, { limit: COMMENTS_PER_PAGE }),
    weatherService.getLocalWeather({ withForecast: false }), // never throws: null when unavailable
  ]);

  res.status(status).render('article', {
    article: toPublicArticle(article),
    weather,
    related: related.map(toRelatedItem),
    comments: comments.items.map(toPublicComment),
    commentCount: comments.total,
    commentLimits: COMMENT_LIMITS,
    commentForm,
    commentErrors,
    rateLimited,
    // Editors get edit/delete buttons on comments. Only a hint for the page:
    // the API checks the role again on every request (routes/api/commentsRoutes.js).
    canModerate: req.session.user?.role === ROLES.EDITOR,
  });
}

// GET /articles/:id
function showArticle(req, res) {
  return renderArticlePage(req, res);
}

// POST /articles/:id/comments: the comment form when JavaScript is off.
// After saving it redirects back to the article (Post/Redirect/Get), so refreshing
// the page afterwards does not send the same comment again.
async function addComment(req, res) {
  const body = req.body ?? {};

  try {
    await commentService.createComment(req.article._id, body, { ip: req.ip });
  } catch (error) {
    if (error.status !== 400) throw error;
    // Show the article again with what the guest typed and what to fix
    return renderArticlePage(req, res, {
      status: 400,
      commentForm: toCommentForm(body),
      commentErrors: toCommentProblems(error.details),
    });
  }

  res.redirect(`/articles/${req.article._id}#comments`);
}

// POST /articles/:id/comments over the limit (see middleware/commentRateLimit.js):
// the article again with the "try again in a minute" message and what the guest typed
function showCommentRateLimited(req, res) {
  return renderArticlePage(req, res, { status: 429, rateLimited: true, commentForm: toCommentForm(req.body ?? {}) });
}

module.exports = { showArticle, addComment, showCommentRateLimited };
