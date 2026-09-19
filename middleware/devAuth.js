const User = require('../models/User');

// Temporary stand-in for login, used only outside production.
// Logs in the user named in DEV_USERNAME, so the rest of the app can rely on req.session.user.
async function devAuth(req, res, next) {
  const username = process.env.DEV_USERNAME;
  if (process.env.NODE_ENV === 'production' || !username) return next();
  if (req.session.user?.username === username) return next();

  const user = await User.findOne({ username: username.toLowerCase() }).lean();
  if (!user) {
    console.warn(`devAuth: no user "${username}" found. Did you run "npm run seed"?`);
    delete req.session.user;
    return next();
  }

  req.session.user = { id: String(user._id), name: user.name, username: user.username, role: user.role };
  next();
}

module.exports = devAuth;
