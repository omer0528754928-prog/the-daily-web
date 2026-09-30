const { listFeed: fetchFeed } = require('../../services/feedService');
const { toFeedCard } = require('../../presenters/feedArticlePresenter');

// GET /api/feed?category=&q=&sort=&limit=&skip=
const listFeed = async (req, res) => {
  const { limit, skip } = req.pagination;
  const { items, hasMore } = await fetchFeed({ filters: req.filters, sort: req.sort, limit, skip });

  res.json({
    data: items.map(toFeedCard),
    meta: { hasMore, limit, skip },
  });
};

module.exports = { listFeed };
