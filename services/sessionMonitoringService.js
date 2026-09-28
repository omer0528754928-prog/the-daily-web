const mongoose = require('mongoose');
const User = require('../models/User');

// Counts unexpired authenticated users, not browsers or currently visible tabs.
async function getActiveAuthenticatedUserCount() {
  const sessions = await mongoose.connection.db.collection('sessions')
    .find({ expires: { $gt: new Date() } }, { projection: { _id: 0, session: 1 } })
    .toArray();
  const userIds = new Set();

  for (const document of sessions) {
    try {
      // connect-mongo stores JSON strings by default.
      const session = typeof document.session === 'string'
        ? JSON.parse(document.session)
        : document.session;
      const id = session?.user?.id;
      if (typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)) {
        userIds.add(id.toLowerCase());
      }
    } catch {
      // Ignore malformed records without exposing session contents.
    }
  }

  if (userIds.size === 0) return 0;
  return User.countDocuments({
    _id: { $in: [...userIds] },
    isDeleted: { $ne: true },
  });
}

module.exports = { getActiveAuthenticatedUserCount };
