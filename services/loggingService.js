const OperationalLog = require('../models/OperationalLog');

// Pass controlled messages and route patterns, never raw errors or request objects.
// Only these explicit fields can be written; callers must keep their values secret-free.
async function recordLog(values) {
  try {
    const { level, source, event, message, userId, method, path, statusCode } = values;
    await OperationalLog.create({ level, source, event, message, userId, method, path, statusCode });
    return true;
  } catch {
    // Do not log the database error: it can contain connection credentials.
    console.error('Could not save operational log.');
    return false;
  }
}

module.exports = { recordLog };
