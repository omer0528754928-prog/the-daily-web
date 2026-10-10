const { listFeed: fetchFeed } = require('../../services/feedService');
const { toFeedCard } = require('../../presenters/feedArticlePresenter');

// GET /api/feed?category=&q=&sort=&limit=&skip=
// The next batch of feed cards as JSON, for the infinite scroll and filter changes in public/js/feed.js.
// req.filters / req.sort come from middleware/feedFilters.js, req.pagination from middleware/pagination.js
const listFeed = async (req, res) => {
  const { limit, skip } = req.pagination;
  const { items, hasMore } = await fetchFeed({ filters: req.filters, sort: req.sort, limit, skip });

  res.json({
    data: items.map(toFeedCard),
    meta: { hasMore, limit, skip },
  });
};

module.exports = { listFeed };
