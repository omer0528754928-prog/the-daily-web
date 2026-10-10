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

// Exact split of views before vs after a moment in time (the last republish).
// Counted from the real view timestamps, not from the graph buckets, so it is precise.
function splitByTime(viewTimes, splitMs) {
  let before = 0;
  let after = 0;
  for (const time of viewTimes) {
    if (new Date(time).getTime() < splitMs) before++;
    else after++;
  }
  return { before, after };
}

// The headline numbers shown above the graph. All are plain counts so the view stays simple.
function buildKpis({ total, peak, updateCount, split }) {
  const kpis = [
    { label: 'סה"כ צפיות', value: total.toLocaleString('en-US'), delta: '' },
    { label: 'שיא צפיות בנקודת זמן', value: peak.toLocaleString('en-US'), delta: '' },
    { label: 'עדכונים שפורסמו', value: String(updateCount), delta: 'מסומנים בגרף' },
  ];
  if (split) {
    kpis.push({
      label: 'צפיות אחרי/לפני העדכון האחרון',
      value: `${split.after.toLocaleString('en-US')} / ${split.before.toLocaleString('en-US')}`,
      delta: split.after >= split.before ? 'יותר צפיות אחרי העדכון' : 'פחות צפיות אחרי העדכון',
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

// Every time the editor approved & published this article, oldest first.
// Read from the operational log, where every approval is already recorded
// (the article id is part of the log message). The first one is the initial
// publish; the rest are updates (getArticleStats makes that distinction).
async function listApprovalTimes(articleId) {
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
  const [viewTimes, approvals] = await Promise.all([listViewTimes(articleId), listApprovalTimes(articleId)]);
  // The first approval is the initial publish, not an update: publish = 0 updates,
  // first update = 1, second = 2, ... So we count the approvals after the first one.
  const updateTimes = approvals.slice(1);
  const series = bucketByTime(viewTimes, Date.now());
  const updates = updateBuckets(updateTimes, series);        // bucket indices, for the graph markers

  const total = viewTimes.length;                            // exact overall view count
  const peak = series.counts.length ? Math.max(...series.counts) : 0;
  // Before/after is measured against the real time of the last republish, not a bucket
  const lastUpdateMs = updateTimes.length ? new Date(updateTimes[updateTimes.length - 1]).getTime() : null;
  const split = lastUpdateMs != null ? splitByTime(viewTimes, lastUpdateMs) : null;

  return { counts: series.counts, labels: series.labels, updates, kpis: buildKpis({ total, peak, updateCount: updateTimes.length, split }) };
}

module.exports = {
  BUCKET_COUNT,
  bucketByTime,
  bucketIndex,
  updateBuckets,
  splitByTime,
  buildKpis,
  listPublishedArticles,
  listViewTimes,
  listApprovalTimes,
  getArticleStats,
};
