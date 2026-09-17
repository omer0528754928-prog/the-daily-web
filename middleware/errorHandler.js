const { isApiRequest } = require('../utils/HttpError');

function notFound(req, res) {
  if (isApiRequest(req)) return res.status(404).json({ error: 'Not found' });
  res.status(404).send('העמוד לא נמצא');
}

// Express calls this with 4 arguments when a route throws or calls next(error)
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || 500;
  if (status >= 500) console.error(err);

  if (isApiRequest(req)) {
    return res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  }
  res.status(status).send(status >= 500 ? 'אירעה שגיאה בשרת' : err.message);
}

module.exports = { notFound, errorHandler };
