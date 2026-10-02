const publicArticleService = require('../services/publicArticleService');
const commentService = require('../services/commentService');
const { toPublicArticle, toRelatedItem } = require('../presenters/publicArticlePresenter');
const { toPublicComment, toCommentProblems, toCommentForm } = require('../presenters/commentPresenter');
const { LIMITS: COMMENT_LIMITS } = require('../validators/commentValidator');

const COMMENTS_PER_PAGE = 20;

// Loads and renders everything on the article page. The whole article is rendered on the
// server, so its full text is already in the first HTML response (search engines and readers
// without JS see it). Also used to show the page again when the comment form has an error.
async function renderArticlePage(req, res, { status = 200, commentForm = {}, commentErrors = [] } = {}) {
  const { article } = req;

  const [related, comments] = await Promise.all([
    publicArticleService.findRelated(article.liveVersion.category, article._id),
    commentService.listForArticle(article._id, { limit: COMMENTS_PER_PAGE }),
  ]);

  res.status(status).render('article', {
    article: toPublicArticle(article),
    related: related.map(toRelatedItem),
    comments: comments.items.map(toPublicComment),
    commentCount: comments.total,
    commentLimits: COMMENT_LIMITS,
    commentForm,
    commentErrors,
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

module.exports = { showArticle, addComment };
