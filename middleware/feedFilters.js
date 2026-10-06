const CATEGORIES = require('../config/categories');
const { SORTS } = require('../services/feedService');
const { HttpError } = require('../utils/HttpError');

const SORT_VALUES = Object.keys(SORTS); // ['date', 'popular']
const VIEW_VALUES = ['all', 'unseen'];
const MAX_SEEN_IDS = 200; // keeps the URL short: 200 ids are about 5KB
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// Reads the home page feed options from the query string (all of them are optional)
// Bad values -> 400 (HttpError goes to the error handler). Good ones -> req.filters and req.sort.
function feedFilters(req, res, next) {
  const { sort, q, category, view, seen } = req.query;

  if (sort && !SORT_VALUES.includes(sort)) {
    throw new HttpError(400, '"sort" must be "date" or "popular"');
  }

  if (category && !CATEGORIES.includes(category)) {
    throw new HttpError(400, `"category" has an unknown value: ${category}`);
  }

  if (view && !VIEW_VALUES.includes(view)) {
    throw new HttpError(400, '"view" must be "unseen" or "all"');
  }

  // The ids of the articles this device already opened (kept in the browser's localStorage by feed.js)
  let seenIds = [];
  if (view==='unseen' && seen) {
    if (typeof seen !== 'string') {
      throw new HttpError(400, '"seen" can only be sent once');
    }
    seenIds = seen.split(',').filter(Boolean); // drops empty items, e.g. from a trailing comma

    if (seenIds.length > MAX_SEEN_IDS) {
      throw new HttpError(400, `"seen" can have at most ${MAX_SEEN_IDS} ids`);
    }
    if (!seenIds.every(id => OBJECT_ID.test(id))) {
      throw new HttpError(400, '"seen" has an invalid id');
    }
  }

  // ?q=a&q=b makes Express give an array instead of a string
  if (q !== undefined && typeof q !== 'string') {
    throw new HttpError(400, '"q" can only be sent once');
  }
  if (q && q.length > 100) {
    throw new HttpError(400, '"q" is too long');
  }

  // empty values ("category=" or a search of only spaces) count as "no filter"
  req.filters = {
    category: category || undefined,
    q: q?.trim() || undefined,
    view: view || undefined,
    seen: seenIds,
  };
  req.sort = sort || 'date';
  next();
}

module.exports = feedFilters;
