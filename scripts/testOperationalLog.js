const mongoose = require('mongoose');

// Every successful run intentionally adds one test OperationalLog document.
async function testOperationalLog() {
  try {
    process.loadEnvFile();
    if (!process.env.MONGODB_URI?.trim()) throw new Error('Missing configuration');
    await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false });
    const { recordLog } = require('../services/loggingService');
    const saved = await recordLog({
      level: 'error',
      source: 'manual_test',
      event: 'manual_server_error',
      message: 'Manual operational log test',
      statusCode: 500,
    });
    console.log(`Log saved: ${saved}`);
    if (!saved) process.exitCode = 1;
  } catch {
    console.error('Could not run the operational log test.');
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

testOperationalLog();
