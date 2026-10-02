const UsageEvent = require('../models/UsageEvent');

// Supply controlled source/value strings, never user secrets or a request object.
async function recordUsageEvent(values) {
  try {
    const { type, source, userId, articleId, value } = values;
    if (!UsageEvent.EVENT_TYPES.includes(type)) return false;
    if (typeof source !== 'string' || !source.trim() || source.length > 100) return false;
    if (value !== undefined && (typeof value !== 'string' || value.length > 200)) return false;

    await UsageEvent.create({ type, source, userId, articleId, value });
    return true;
  } catch {
    console.error('Could not save usage event.');
    return false;
  }
}

module.exports = { recordUsageEvent };
