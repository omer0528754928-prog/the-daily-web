const mongoose = require('mongoose');
const { LIMITS } = require('../validators/commentValidator');

// Saved when a guest leaves the name empty
const GUEST_NAME = 'אורח';

const commentSchema = new mongoose.Schema(
  {
    articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
    authorName: { type: String, trim: true, maxlength: LIMITS.authorName, default: GUEST_NAME },
    text: { type: String, required: true, trim: true, maxlength: LIMITS.text },
    // Who sent the comment, kept for spam checks. select: false means it is only loaded
    // when asked for by name, so it can never reach the page by accident.
    ip: { type: String, select: false },
  },
  { timestamps: true },
);

// The newest comments of one article first (_id breaks ties between comments saved in the
// same millisecond, so paging never skips or repeats one). Also serves countDocuments({ articleId }).
commentSchema.index({ articleId: 1, createdAt: -1, _id: -1 });

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
module.exports.GUEST_NAME = GUEST_NAME;
