const { EDITABLE_STATUSES } = require('../config/articleStatus');
const { HttpError, isApiRequest } = require('../utils/HttpError');

// Blocks changes to req.article while it waits for the editor.
// Pages go to the read-only view; the API answers 409 Conflict.
function requireEditable(req, res, next) {
  if (EDITABLE_STATUSES.includes(req.article.status)) return next();

  if (isApiRequest(req)) {
    throw new HttpError(409, 'Article is waiting for editor approval and cannot be changed');
  }
  res.redirect(`/reporter/articles/${req.article._id}`);
}

module.exports = requireEditable;
