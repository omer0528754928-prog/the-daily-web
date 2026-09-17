// An error that carries an HTTP status code, e.g. throw new HttpError(404, 'Article not found')
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function isApiRequest(req) {
  return req.originalUrl.startsWith('/api/');
}

module.exports = { HttpError, isApiRequest };
