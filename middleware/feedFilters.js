const CATEGORIES = require('../config/categories');
const {SORTS} = require('../services/feedService');
const { HttpError } = require('../utils/HttpError');
const SORT_VALUES = Object.keys(SORTS); // ['date', 'popular']

// Reads the home page feed options from the query string
function feedFilters (req, res, next) {
  const { sort, q, category } = req.query;

  //all optional

  if(sort&&!SORT_VALUES.includes(sort))
  {
    throw new HttpError(400, '"sort" must be "date" or "popular"');
  }

  if (category&&!CATEGORIES.includes(category)) {
    throw new HttpError(400, `"category" has an unknown value: ${category}`);
  }
  
  if (q !== undefined && typeof q !== 'string') {
    throw new HttpError(400, '"q" can only be sent once');
  }
  if (q && q.length > 100) {
    throw new HttpError(400, '"q" is too long');
  }
  req.filters = { category: category || undefined, q: q?.trim() || undefined };
  req.sort = sort || 'date';
  next();
}

module.exports = feedFilters;
