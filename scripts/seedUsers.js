// Prepares demo login users only. Does not change articles or reactivate deleted users.
// Usage: npm run seed:users. Initial passwords match usernames; existing hashes are kept.
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const { ROLES } = User;
const HASH_ROUNDS = 10;
const USERS = [
  { username: 'reporter01', name: 'דנה לוי', role: ROLES.REPORTER },
  { username: 'reporter02', name: 'עומר שגב', role: ROLES.REPORTER },
  { username: 'reporter03', name: 'רותם אבן', role: ROLES.REPORTER },
  { username: 'reporter04', name: 'נועה גל', role: ROLES.REPORTER },
  { username: 'editor01', name: 'איתן ברק', role: ROLES.EDITOR },
  { username: 'test_reporter', name: 'Test Reporter', role: ROLES.REPORTER },
  { username: 'test_editor', name: 'Test Editor', role: ROLES.EDITOR },
];

async function seedUsers() {
  // Report only controlled messages: driver errors can contain connection credentials.
  let failureMessage = 'Could not load the environment file.';
  try {
    process.loadEnvFile();
    failureMessage = 'MONGODB_URI is required.';
    if (!process.env.MONGODB_URI?.trim()) throw new Error(failureMessage);

    // Connect directly so this script controls error output and always disconnects.
    failureMessage = 'Could not connect to MongoDB. Check MONGODB_URI and the local server.';
    await mongoose.connect(process.env.MONGODB_URI);

    for (const demo of USERS) {
      failureMessage = `Could not prepare ${demo.username}. Check the database connection and username uniqueness.`;
      const existing = await User.findOne({ username: demo.username }).select('+passwordHash').lean();
      if (existing?.isDeleted === true) {
        console.log(`Skipped reactivation for deleted ${demo.username}`);
        continue;
      }

      if (existing) {
        const fields = { name: demo.name, role: demo.role };
        if (!existing.passwordHash) {
          fields.passwordHash = await bcrypt.hash(demo.username, HASH_ROUNDS);
        }
        // Update the same document; leave its id, username and createdAt untouched.
        // Recheck deletion in case it changed after the lookup.
        const result = await User.updateOne(
          { _id: existing._id, isDeleted: { $ne: true } },
          { $set: fields },
          { runValidators: true },
        );
        console.log(result.matchedCount
          ? `Updated ${demo.username}`
          : `Skipped ${demo.username}: no longer active or no longer exists`);
      } else {
        const passwordHash = await bcrypt.hash(demo.username, HASH_ROUNDS);
        await User.create({ ...demo, passwordHash, isDeleted: false });
        console.log(`Created ${demo.username}`);
      }
    }
  } catch {
    console.error(`Demo user seed failed: ${failureMessage}`);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      console.error('Demo user seed failed to close the MongoDB connection.');
      process.exitCode = 1;
    }
  }
}

seedUsers();
