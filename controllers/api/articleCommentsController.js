const commentService = require('../../services/commentService');
const { toPublicComment, toCommentProblems } = require('../../presenters/commentPresenter');

// GET /api/articles/:id/comments?limit=&skip=: older comments for "load more", newest first
async function listComments(req, res) {
  const { limit, skip } = req.pagination;
  const { items, total } = await commentService.listForArticle(req.article._id, { limit, skip });

  res.json({
    data: items.map(toPublicComment),
    meta: { total, limit, skip },
  });
}

// POST /api/articles/:id/comments: the same comment form, sent by public/js/comments.js
async function createComment(req, res) {
  let comment;
  try {
    comment = await commentService.createComment(req.article._id, req.body ?? {}, { ip: req.ip });
  } catch (error) {
    if (error.status !== 400) throw error;
    // The same 400 the error handler would send, plus the Hebrew messages the page shows
    return res.status(400).json({
      error: error.message,
      details: error.details,
      messages: toCommentProblems(error.details),
    });
  }

  res.status(201).json({ data: toPublicComment(comment) });
}

module.exports = { listComments, createComment };
