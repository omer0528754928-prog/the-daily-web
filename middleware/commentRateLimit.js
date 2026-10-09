const { isApiRequest } = require('../utils/HttpError');
const { RATE_LIMITED_MESSAGE } = require('../presenters/commentPresenter');
const articleController = require('../controllers/articleController');

const COMMENTS_PER_MINUTE = 3;
const WINDOW_MS = 60 * 1000;

// At most 3 comments a minute from the same device, enforced here on the server.
// "Device" = IP address: a cookie would be easy to delete to get a fresh limit, an IP is not.
// Downside: people sharing one network share the limit.
// The counts are kept in the server's memory: enough for one server, and they start
// from zero after a restart.

// IP address -> the times (ms) of that device's comments in the last minute, oldest first
const recentComments = new Map();

// The device's comment times from the last minute; older ones no longer count and are dropped
function recentTimes(key, now) {
  const times = (recentComments.get(key) || []).filter(time => now - time < WINDOW_MS);
  if (times.length) recentComments.set(key, times);
  else recentComments.delete(key);
  return times;
}

// Gives back a place taken by a comment that was not saved
function release(key, takenAt) {
  const times = recentComments.get(key);
  const index = times ? times.indexOf(takenAt) : -1;
  if (index === -1) return;
  times.splice(index, 1);
  if (!times.length) recentComments.delete(key);
}

// Used on both comment routes (form and API), so they share the same count
function commentRateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const times = recentTimes(key, now);

  if (times.length >= COMMENTS_PER_MINUTE) {
    // Seconds until the oldest of the 3 is a minute old and the next comment is allowed
    res.set('Retry-After', String(Math.ceil((times[0] + WINDOW_MS - now) / 1000)));
    res.status(429);
    // public/js/comments.js shows "messages" next to the form
    if (isApiRequest(req)) return res.json({ error: 'Too many comments', messages: [RATE_LIMITED_MESSAGE] });
    // The form without JavaScript: the article page again, with the message and the typed text
    return articleController.showCommentRateLimited(req, res);
  }

  // Take a place now, before the comment is saved, so several comments sent at the same
  // moment cannot all slip through. If the comment is not saved (rejected by validation,
  // a server error, or the connection dropped), the place is given back: only saved
  // comments use up the 3.
  times.push(now);
  recentComments.set(key, times);
  res.on('close', () => {
    if (!res.writableFinished || res.statusCode >= 400) release(key, now);
  });
  next();
}

// Once a minute, forget devices that have not commented in the last minute,
// so the map does not keep growing. unref(): this timer alone never keeps the server running.
setInterval(() => {
  const now = Date.now();
  for (const key of recentComments.keys()) recentTimes(key, now);
}, WINDOW_MS).unref();

// For the tests: start one device's count from zero
commentRateLimit.resetKey = key => recentComments.delete(key);

module.exports = commentRateLimit;
