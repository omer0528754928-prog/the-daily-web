const Article = require('../models/Article');

// Fields needed for the feed cards (the body is large, so it is left out)
const FEED_FIELDS = 'liveVersion.title liveVersion.summary liveVersion.category liveVersion.image liveVersion.publishedAt views author';

// Must match the feed indexes in models/Article.js, or MongoDB won't use them
const SORTS = {
  date: { 'liveVersion.publishedAt': -1, _id: -1 },
  popular: { views: -1, _id: -1 },
};

// Turns the filters from the home page into a MongoDB query
function buildFeedFilter(filters = {}) {
  const filter = { liveVersion: { $ne: null } };

  if (filters.category?.length) filter['liveVersion.category'] = filters.category;
  if (filters.q?.length) filter.$text = { $search: filters.q };

  return filter;
}

// One batch of published articles. Fetches one extra row to know if there are more.
const listFeed = async ({ filters = {}, sort = 'date', limit = 20, skip = 0 } = {}) => {
  let hasMore = false;
  const sortBy = SORTS[sort];

  const items = await Article.find(buildFeedFilter(filters))
    .select(FEED_FIELDS)
    .sort(sortBy)
    .populate('author', 'name')
    .skip(skip)
    .limit(limit + 1)
    .lean();

  if (items.length > limit) {
    hasMore = true;
    items.pop();
  }

  return { items, hasMore };
};


const listPopular=async(count=5)=>{
  return (await listFeed({ sort: 'popular', limit: count })).items;
};

module.exports = { listPopular, listFeed , SORTS };
