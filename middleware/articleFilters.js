const CATEGORIES = require('../config/categories');
const { STATUS } = require('../config/articleStatus');
const { HttpError } = require('../utils/HttpError');

const STATUS_VALUES = Object.values(STATUS);

// A query value can arrive once ("?category=ספורט") or several times
// ("?category=ספורט&category=חדשות"); both become an array here
function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function pickAllowed(values, allowed, name) {
  const chosen = toArray(values).filter(value => value !== '');
  const unknown = chosen.find(value => !allowed.includes(value));
  if (unknown) throw new HttpError(400, `"${name}" has an unknown value: ${unknown}`);
  return chosen;
}

// "2026-09-10" from a date input; endOfDay makes the "to" date include that whole day
function parseDate(raw, name, { endOfDay = false } = {}) {
  if (raw === undefined || raw === '') return undefined;
  const date = new Date(endOfDay ? `${raw}T23:59:59.999` : raw);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `"${name}" is not a valid date`);
  return date;
}

// Reads the column filters from the query string into req.filters
function articleFilters(req, res, next) {
  const returned = req.query.returned;
  if (returned !== undefined && returned !== '' && returned !== 'yes' && returned !== 'no') {
    throw new HttpError(400, '"returned" must be "yes" or "no"');
  }

  const publishedFrom = parseDate(req.query.publishedFrom, 'publishedFrom');
  const publishedTo = parseDate(req.query.publishedTo, 'publishedTo', { endOfDay: true });
  if (publishedFrom && publishedTo && publishedFrom > publishedTo) {
    throw new HttpError(400, '"publishedFrom" must be before "publishedTo"');
  }

  req.filters = {
    category: pickAllowed(req.query.category, CATEGORIES, 'category'),
    status: pickAllowed(req.query.status, STATUS_VALUES, 'status'),
    returned: returned || undefined,
    publishedFrom,
    publishedTo,
  };
  next();
}

module.exports = articleFilters;
