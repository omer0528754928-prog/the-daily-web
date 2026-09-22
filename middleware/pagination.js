const { HttpError } = require('../utils/HttpError');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseNonNegativeInt(value, name) {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new HttpError(400, `"${name}" must be a non-negative integer`);
  return Number(value);
}

// Reads ?limit=&skip= from the query string into req.pagination
function pagination(req, res, next) {
  const limit = parseNonNegativeInt(req.query.limit, 'limit') ?? DEFAULT_LIMIT;
  const skip = parseNonNegativeInt(req.query.skip, 'skip') ?? 0;

  if (limit < 1 || limit > MAX_LIMIT) {
    throw new HttpError(400, `"limit" must be between 1 and ${MAX_LIMIT}`);
  }

  req.pagination = { limit, skip };
  next();
}

// Page-based paging for the HTML table: ?page=2 with a fixed page size
function paginationByPage(pageSize = 10) {
  return (req, res, next) => {
    const page = parseNonNegativeInt(req.query.page, 'page') ?? 1;
    if (page < 1) throw new HttpError(400, '"page" must be 1 or more');

    req.pagination = { page, limit: pageSize, skip: (page - 1) * pageSize };
    next();
  };
}

module.exports = pagination;
module.exports.paginationByPage = paginationByPage;
