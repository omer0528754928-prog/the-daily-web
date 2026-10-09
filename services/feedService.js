const Article = require('../models/Article');

// Fields needed for the feed cards (the body is large, so it is left out)
const FEED_FIELDS = 'liveVersion.title liveVersion.summary liveVersion.category liveVersion.image liveVersion.publishedAt views author';

// Must match the feed indexes in models/Article.js, or MongoDB won't use them
const SORTS = {
  date: { 'liveVersion.publishedAt': -1, _id: -1 },
  popular: { views: -1, _id: -1 },
};

// Characters with a meaning in a regex (. * ( ...) are escaped, so the search is plain text
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Turns the filters from the home page into a MongoDB query
function buildFeedFilter(filters = {}) {
  // only articles an editor approved at least once (liveVersion is null before that)
  const filter = { liveVersion: { $ne: null } };

  if (filters.category?.length) filter['liveVersion.category'] = filters.category;
  // Matches the text anywhere in the title or the summary, so "משטרה" also finds "המשטרה"
  // (Hebrew glues ה/ו/ב/ל/מ/ש to the word, which a whole-word text index misses).
  // MongoDB picks the cheaper plan: the title + summary indexes (see models/Article.js) or the sort's index.
  if (filters.q?.length) {
    const text = { $regex: escapeRegex(filters.q) };
    filter.$or = [{ 'liveVersion.title': text }, { 'liveVersion.summary': text }];
  }
  // "unseen": leave out the articles this device already opened (Mongoose turns the id strings into ObjectIds)
  if (filters.view === 'unseen' && filters.seen?.length) filter._id = { $nin: filters.seen };

  return filter;
}

// One batch of published articles. Fetches one extra row to know if there are more.
// Returns { items, hasMore }; skip is how many articles were already shown.
const listFeed = async ({ filters = {}, sort = 'date', limit = 20, skip = 0 } = {}) => {
  let hasMore = false;
  const sortBy = SORTS[sort];

  const items = await Article.find(buildFeedFilter(filters))
    .select(FEED_FIELDS)
    .sort(sortBy)
    .populate('author', 'name') // only the reporter's name, for the card
    .skip(skip)
    .limit(limit + 1)
    .lean(); // plain objects instead of Mongoose documents: faster, and we only read them

  // The extra row came back, so there is at least one more article after this batch.
  // It is dropped here; the next batch (skip + limit) starts with it.
  if (items.length > limit) {
    hasMore = true;
    items.pop();
  }

  return { items, hasMore };
};


// The most viewed articles, for the "הנצפות ביותר" sidebar
const listPopular=async(count=5)=>{
  return (await listFeed({ sort: 'popular', limit: count })).items;
};

module.exports = { listPopular, listFeed , SORTS };
