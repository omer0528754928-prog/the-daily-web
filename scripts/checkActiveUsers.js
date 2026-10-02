const mongoose = require('mongoose');

async function checkActiveUsers() {
  try {
    process.loadEnvFile();
    if (!process.env.MONGODB_URI?.trim()) throw new Error('Missing configuration');
    // Keep this command read-only, including model collection/index setup.
    await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false });
    const { getActiveAuthenticatedUserCount } = require('../services/sessionMonitoringService');
    const count = await getActiveAuthenticatedUserCount();
    console.log(`Active authenticated users: ${count}`);
  } catch {
    console.error('Could not check active authenticated users.');
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      console.error('Could not close the MongoDB connection.');
      process.exitCode = 1;
    }
  }
}

checkActiveUsers();
