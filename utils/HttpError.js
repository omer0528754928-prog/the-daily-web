// An error that carries an HTTP status code, e.g. throw new HttpError(404, 'Article not found').
// details holds per-field validation messages, e.g. { title: 'Title is required' }
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (details) this.details = details;
  }
}

function isApiRequest(req) {
  return req.originalUrl.startsWith('/api/');
}

module.exports = { HttpError, isApiRequest };
