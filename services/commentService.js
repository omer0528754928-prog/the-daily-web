const Comment = require('../models/Comment');
const { HttpError } = require('../utils/HttpError');
const { validateComment } = require('../validators/commentValidator');

// What readers may see. ip is left out (and is select: false in the schema anyway).
const PUBLIC_FIELDS = 'authorName text createdAt';
const OBJECT_ID = /^[a-f\d]{24}$/i;

// A malformed id gets the same 404 as a missing comment, before it reaches MongoDB
function checkCommentId(commentId) {
  if (!OBJECT_ID.test(commentId)) throw new HttpError(404, 'Comment not found');
}

// The newest comments of an article, one page at a time, plus how many there are in total
async function listForArticle(articleId, { limit = 20, skip = 0 } = {}) {
  const filter = { articleId };

  const [items, total] = await Promise.all([
    Comment.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Comment.countDocuments(filter),
  ]);

  return { items, total };
}

// Validates and saves a guest comment. Throws 400 with a message per field when the input is not valid.
async function createComment(articleId, input, { ip } = {}) {
  const { value, errors } = validateComment(input);
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

  const comment = await Comment.create({
    articleId,
    // undefined (not '') lets the schema fill in the guest name
    authorName: value.authorName || undefined,
    text: value.text,
    ip,
  });

  // Only the public fields go back to the caller, never the ip
  return { _id: comment._id, authorName: comment.authorName, text: comment.text, createdAt: comment.createdAt };
}

// Editor only: fixes a comment. Fields left out of input keep their value, and the same
// rules apply as for a new comment. Returns the updated comment, or throws 404 / 400.
async function updateComment(commentId, input = {}) {
  checkCommentId(commentId);
  const current = await Comment.findById(commentId).select(PUBLIC_FIELDS).lean();
  if (!current) throw new HttpError(404, 'Comment not found');

  const { value, errors } = validateComment({
    name: input.name ?? current.authorName,
    text: input.text ?? current.text,
  });
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

  const updated = await Comment.findByIdAndUpdate(
    commentId,
    { $set: { authorName: value.authorName || Comment.GUEST_NAME, text: value.text } },
    { returnDocument: 'after', runValidators: true },
  )
    .select(`${PUBLIC_FIELDS} articleId`)
    .lean();
  // Deleted by another editor between the two queries
  if (!updated) throw new HttpError(404, 'Comment not found');
  return updated;
}

// Editor only: deletes one comment. Returns it (for the log), or throws 404.
async function deleteComment(commentId) {
  checkCommentId(commentId);
  const deleted = await Comment.findByIdAndDelete(commentId).select('articleId').lean();
  if (!deleted) throw new HttpError(404, 'Comment not found');
  return deleted;
}

// Deletes every comment of an article. For the editor's "delete article" action, so no
// comments are left behind for an article that no longer exists. Returns how many were deleted.
async function deleteByArticle(articleId) {
  const { deletedCount } = await Comment.deleteMany({ articleId });
  return deletedCount;
}

module.exports = { listForArticle, createComment, updateComment, deleteComment, deleteByArticle };
