'use strict';

/**
 * Live-users presence — Member 5.
 * ---------------------------------------------------------------------------
 * A tiny in-memory tracker of who is "currently on the site". Every open page
 * sends a small heartbeat ("ping") every few seconds; we remember the last
 * time we heard from each visitor (keyed by their session id) and count how
 * many were active within the last WINDOW milliseconds.
 *
 * No external library — plain JavaScript, updated over Ajax polling. Because
 * it lives in memory, the count resets if the server restarts (which is fine
 * for a "live right now" number).
 * ---------------------------------------------------------------------------
 */

const WINDOW_MS = 60 * 1000; // "active" = seen in the last 60 seconds
const seen = new Map();      // token -> last-seen timestamp (ms)

function touch(token) {
  if (!token) return;
  seen.set(token, Date.now());
}

function count(windowMs = WINDOW_MS) {
  const now = Date.now();
  let n = 0;
  for (const [token, ts] of seen) {
    if (now - ts > windowMs) seen.delete(token); // prune the stale ones
    else n += 1;
  }
  return n;
}

module.exports = { touch, count, WINDOW_MS };
