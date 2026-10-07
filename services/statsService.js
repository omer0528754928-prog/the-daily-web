const UsageEvent = require('../models/UsageEvent');
const OperationalLog = require('../models/OperationalLog');
const Article = require('../models/Article');

// How many points the Impact Analytics graph draws along the time axis
const BUCKET_COUNT = 16;
const DAY_MS = 24 * 60 * 60 * 1000;

// --- pure helpers (no database) so they can be unit-tested on their own ---

// Splits view timestamps into equal-width time buckets, from the first view to "now".
// Returns counts per bucket, a label per bucket, and the bucket geometry (from/width)
// so update points can be placed on the same axis.
function bucketByTime(timestamps, nowMs, bucketCount = BUCKET_COUNT) {
  if (!timestamps.length) return { counts: [], labels: [], from: null, to: null, width: 0, bucketCount };

  const times = timestamps.map(t => new Date(t).getTime()).sort((a, b) => a - b);
  const from = times[0];
  const to = Math.max(nowMs, times[times.length - 1]);
  const width = Math.max((to - from) / bucketCount, 1); // never 0, so division is safe

  const counts = new Array(bucketCount).fill(0);
  for (const time of times) counts[bucketIndex(time, from, width, bucketCount)]++;

  const hourly = to - from <= 2 * DAY_MS; // short span -> show hours, otherwise dates
  const labels = counts.map((_, i) => formatLabel(from + i * width, hourly));
  return { counts, labels, from, to, width, bucketCount };
}

// Which bucket a single timestamp falls into (the right edge belongs to the last bucket)
function bucketIndex(timeMs, from, width, bucketCount = BUCKET_COUNT) {
  const index = Math.floor((timeMs - from) / width);
  if (index < 0) return 0;
  if (index >= bucketCount) return bucketCount - 1;
  return index;
}

// Maps update-publish timestamps onto the bucketed axis, as a sorted list of bucket indices
function updateBuckets(updateTimes, series) {
  if (series.from == null || !series.width) return [];
  const indices = updateTimes
    .map(t => new Date(t).getTime())
    .filter(ms => ms >= series.from && ms <= series.to)
    .map(ms => bucketIndex(ms, series.from, series.width, series.bucketCount));
  return [...new Set(indices)].sort((a, b) => a - b);
}

function formatLabel(ms, hourly) {
  const date = new Date(ms);
  if (hourly) return `${String(date.getHours()).padStart(2, '0')}:00`;
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

// A few headline numbers derived from the same series, so the view stays simple
function buildKpis(series, updateIndices) {
  const counts = series.counts;
  const total = counts.reduce((sum, n) => sum + n, 0);
  const peak = counts.length ? Math.max(...counts) : 0;

  // Views before vs after the last published update, to show its impact
  let beforeAfter = null;
  if (updateIndices.length) {
    const last = updateIndices[updateIndices.length - 1];
    const before = counts.slice(0, last).reduce((sum, n) => sum + n, 0);
    const after = counts.slice(last).reduce((sum, n) => sum + n, 0);
    beforeAfter = { before, after };
  }

  const kpis = [
    { label: 'סה"כ צפיות', value: total.toLocaleString('en-US'), delta: `${counts.length} נקודות זמן` },
    { label: 'שיא צפיות בנקודת זמן', value: peak.toLocaleString('en-US'), delta: '' },
    { label: 'עדכונים שפורסמו', value: String(updateIndices.length), delta: 'מסומנים בגרף' },
  ];
  if (beforeAfter) {
    kpis.push({
      label: 'צפיות אחרי/לפני העדכון האחרון',
      value: `${beforeAfter.after.toLocaleString('en-US')} / ${beforeAfter.before.toLocaleString('en-US')}`,
      delta: beforeAfter.after >= beforeAfter.before ? 'עלייה אחרי העדכון' : 'ירידה אחרי העדכון',
    });
  }
  return kpis;
}

// --- database reads ---

// Articles that were ever published (have a public version), newest first — the ones
// worth inspecting. Used to fill the article picker.
function listPublishedArticles(limit = 200) {
  return Article.find({ 'liveVersion.publishedAt': { $ne: null } })
    .select('title liveVersion.publishedAt')
    .sort({ 'liveVersion.publishedAt': -1 })
    .limit(limit)
    .lean();
}

// Every recorded view of one article, oldest first (only the timestamp is needed)
async function listViewTimes(articleId) {
  const events = await UsageEvent.find({ articleId, type: 'article_view' })
    .select('createdAt')
    .sort({ createdAt: 1 })
    .lean();
  return events.map(event => event.createdAt);
}

// The times the editor approved & published an update of this article.
// Read from the operational log, where every approval is already recorded
// (the article id is part of the log message).
async function listUpdateTimes(articleId) {
  const id = String(articleId);
  const logs = await OperationalLog.find({ source: 'editor', event: 'article_approved' })
    .select('message createdAt')
    .sort({ createdAt: 1 })
    .lean();
  return logs.filter(log => typeof log.message === 'string' && log.message.includes(id)).map(log => log.createdAt);
}

// Everything the stats page needs for one article: the view series, the update
// markers placed on the same axis, and the headline numbers.
async function getArticleStats(articleId) {
  const [viewTimes, updateTimes] = await Promise.all([listViewTimes(articleId), listUpdateTimes(articleId)]);
  const series = bucketByTime(viewTimes, Date.now());
  const updates = updateBuckets(updateTimes, series);
  return { counts: series.counts, labels: series.labels, updates, kpis: buildKpis(series, updates) };
}

module.exports = {
  BUCKET_COUNT,
  bucketByTime,
  bucketIndex,
  updateBuckets,
  buildKpis,
  listPublishedArticles,
  listViewTimes,
  listUpdateTimes,
  getArticleStats,
};
