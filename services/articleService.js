const Article = require('../models/Article');

// Fields needed for article lists (the body is large, so it is left out)
const LIST_FIELDS = 'title category status editorNotes returnedCount views publishedAt updatedAt';

async function listByAuthor(authorId, { limit = 0, skip = 0 } = {}) {
  const filter = { author: authorId };

  const [items, total] = await Promise.all([
    Article.find(filter)
      .select(LIST_FIELDS)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Article.countDocuments(filter),
  ]);

  return { items, total };
}

module.exports = { listByAuthor };
