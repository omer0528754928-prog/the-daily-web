const Comment = require('../models/Comment');
const { HttpError } = require('../utils/HttpError');
const { validateComment } = require('../validators/commentValidator');

// What readers may see. ip is left out (and is select: false in the schema anyway).
const PUBLIC_FIELDS = 'authorName text createdAt';

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

module.exports = { listForArticle, createComment };
