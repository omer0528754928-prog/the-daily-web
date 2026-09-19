'use strict';

/**
 * Auth middleware — server-side permission guards.
 * ---------------------------------------------------------------------------
 * ⚠️  PROVISIONAL — the real login/session belongs to Member 1.
 *     These guards read req.session.user (the agreed contract shape):
 *         req.session.user = { _id, name, role }   // role: 'reporter' | 'editor'
 *     When Member 1 delivers real authentication, this file can stay as-is,
 *     because it depends ONLY on that shape — nothing else.
 *
 *     Golden rule of the project: permission checks MUST run on the server.
 *     Hiding a button in the browser is NOT security.
 * ---------------------------------------------------------------------------
 */

// Does this request expect a JSON answer (an Ajax/API call) rather than a page?
function wantsJson(req) {
  return (
    req.originalUrl.includes('/api/') ||
    (req.get('accept') || '').includes('application/json') ||
    req.get('x-requested-with') === 'XMLHttpRequest'
  );
}

// Must be logged in (any role).
function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  if (wantsJson(req)) return res.status(401).json({ error: 'עליך להתחבר תחילה' });
  return res.redirect('/editor/login');
}

// Must be logged in AND have a specific role (e.g. 'editor').
function requireRole(role) {
  return function (req, res, next) {
    const user = req.session && req.session.user;
    if (!user) {
      if (wantsJson(req)) return res.status(401).json({ error: 'עליך להתחבר תחילה' });
      return res.redirect('/editor/login');
    }
    if (user.role !== role) {
      if (wantsJson(req)) return res.status(403).json({ error: 'אין לך הרשאה לפעולה זו' });
      return res.status(403).send('403 — אין לך הרשאה לצפות בעמוד זה');
    }
    return next();
  };
}

module.exports = { requireLogin, requireRole, wantsJson };
