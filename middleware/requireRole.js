const { HttpError, isApiRequest } = require('../utils/HttpError');

// Allows the request only for a logged-in user with one of the given roles.
// API requests get a JSON 401/403; pages redirect to login or get a 403 message.
function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session.user;

    if (!user) {
      if (isApiRequest(req)) return next(new HttpError(401, 'Not logged in'));
      return res.redirect('/login');
    }

    if (!roles.includes(user.role)) {
      if (isApiRequest(req)) return next(new HttpError(403, 'Forbidden'));
      return res.status(403).send('אין לך הרשאה לצפות בעמוד זה');
    }

    next();
  };
}

module.exports = requireRole;
