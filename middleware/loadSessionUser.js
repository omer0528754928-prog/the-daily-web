const authService = require('../services/authService');

async function loadSessionUser(req, res, next) {
  res.locals.currentUser = null;
  if (!req.session.user) return next();

  try {
    const user = await authService.findSessionUser(req.session.user.id);
    if (user) {
      req.session.user = user;
      res.locals.currentUser = user;
    } else {
      delete req.session.user;
    }
    return next();
  } catch (error) {
    // Do not run protected routes with stale permissions after a database failure.
    return next(error);
  }
}

module.exports = loadSessionUser;
