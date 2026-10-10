const commentService = require('../../services/commentService');
const { recordLog } = require('../../services/loggingService');
const { toPublicComment, toValidationProblem } = require('../../presenters/commentPresenter');

// Writes the editor's action to the operational log (ids only, never the comment text)
function logCommentAction(req, event, comment) {
  const userId = req.session.user?.id;
  void recordLog({
    level: 'info',
    source: 'comments',
    event,
    message: `Comment ${comment._id} on article ${comment.articleId}`,
    userId: typeof userId === 'string' && /^[a-f\d]{24}$/i.test(userId) ? userId : undefined,
    method: req.method,
    path: typeof req.route?.path === 'string' ? req.route.path : undefined,
    statusCode: event === 'comment_deleted' ? 204 : 200,
  });
}

// PATCH /api/comments/:id (editor only): fixes the name or the text of a comment
async function updateComment(req, res) {
  let comment;
  try {
    comment = await commentService.updateComment(req.params.id, req.body ?? {});
  } catch (error) {
    if (error.status !== 400) throw error;
    return res.status(400).json(toValidationProblem(error));
  }

  logCommentAction(req, 'comment_updated', comment);
  res.json({ data: toPublicComment(comment) });
}

// DELETE /api/comments/:id (editor only)
async function deleteComment(req, res) {
  const comment = await commentService.deleteComment(req.params.id);
  logCommentAction(req, 'comment_deleted', comment);
  res.status(204).end();
}

module.exports = { updateComment, deleteComment };
