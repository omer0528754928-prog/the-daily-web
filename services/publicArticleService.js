const Article = require('../models/Article');

// The public page reads only liveVersion (the approved copy). The working copy fields
// (title, body, ...) are left out on purpose, so unapproved edits can never reach readers.
const PUBLIC_FIELDS = 'liveVersion author views';
const RELATED_FIELDS = 'liveVersion.title liveVersion.publishedAt author';
const RELATED_LIMIT = 4;

// Returns the article only if the editor approved it at least once, otherwise null.
// "Public" means liveVersion exists, not status === 'published': a pending or returned
// article can still have an approved version that readers should keep seeing.
function findPublicArticle(articleId) {
  return Article.findOne({ _id: articleId, liveVersion: { $ne: null } })
    .select(PUBLIC_FIELDS)
    .populate('author', 'name')
    .lean();
}

// A few other public articles in the same category, newest first (the body is left out)
function findRelated(category, excludeId, limit = RELATED_LIMIT) {
  return Article.find({ _id: { $ne: excludeId }, 'liveVersion.category': category })
    .select(RELATED_FIELDS)
    .populate('author', 'name')
    .sort({ 'liveVersion.publishedAt': -1 })
    .limit(limit)
    .lean();
}

module.exports = { findPublicArticle, findRelated };
