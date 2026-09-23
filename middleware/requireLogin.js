const { HttpError, isApiRequest } = require('../utils/HttpError');

function requireLogin(req, res, next) {
  if (req.session.user) return next();

  if (isApiRequest(req)) {
    return next(new HttpError(401, 'Not logged in'));
  }

  return res.redirect('/login');
}

module.exports = requireLogin;
