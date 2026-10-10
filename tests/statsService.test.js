// Tests the pure bucketing/mapping logic of services/statsService.js — the maths that
// turns raw view timestamps and update times into the series the Impact Analytics graph
// draws. No database: only node:test + node:assert.
// Run with: npm test

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { bucketByTime, bucketIndex, updateBuckets, splitByTime, buildKpis } = require('../services/statsService');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('statsService.bucketByTime', () => {
  it('returns an empty series when there are no views', () => {
    const series = bucketByTime([], Date.now());
    assert.deepStrictEqual(series.counts, []);
    assert.deepStrictEqual(series.labels, []);
    assert.strictEqual(series.from, null);
  });

  it('counts every view across the buckets (nothing lost)', () => {
    const now = 100 * HOUR;
    const times = [new Date(0), new Date(10 * HOUR), new Date(50 * HOUR), new Date(99 * HOUR)];
    const series = bucketByTime(times, now, 10);
    assert.strictEqual(series.counts.length, 10);
    assert.strictEqual(series.counts.reduce((a, b) => a + b, 0), times.length);
  });

  it('puts the earliest view in the first bucket and the latest in the last', () => {
    const now = 16 * HOUR;
    const series = bucketByTime([new Date(0), new Date(16 * HOUR)], now, 16);
    assert.strictEqual(series.counts[0], 1);
    assert.strictEqual(series.counts[series.counts.length - 1], 1);
  });

  it('labels by hour for a short span and by date for a long one', () => {
    const shortSpan = bucketByTime([new Date(0), new Date(6 * HOUR)], 6 * HOUR, 6);
    assert.match(shortSpan.labels[0], /^\d{2}:\d{2}$/); // HH:00
    const longSpan = bucketByTime([new Date(0), new Date(10 * DAY)], 10 * DAY, 10);
    assert.doesNotMatch(longSpan.labels[0], /^\d{2}:\d{2}$/); // a date, not a time
  });
});

describe('statsService.bucketIndex', () => {
  it('clamps times outside the range into the end buckets', () => {
    const from = 0, width = HOUR, count = 5;
    assert.strictEqual(bucketIndex(-HOUR, from, width, count), 0);     // before the start
    assert.strictEqual(bucketIndex(100 * HOUR, from, width, count), 4); // after the end
    assert.strictEqual(bucketIndex(2.5 * HOUR, from, width, count), 2); // in the middle
  });
});

describe('statsService.updateBuckets', () => {
  it('maps update times to sorted, de-duplicated bucket indices on the same axis', () => {
    const series = bucketByTime([new Date(0), new Date(16 * HOUR)], 16 * HOUR, 16); // width = 1h
    const updates = updateBuckets([new Date(4 * HOUR), new Date(8 * HOUR), new Date(8 * HOUR)], series);
    assert.deepStrictEqual(updates, [4, 8]);
  });

  it('ignores update times outside the view window', () => {
    const series = bucketByTime([new Date(0), new Date(10 * HOUR)], 10 * HOUR, 10);
    assert.deepStrictEqual(updateBuckets([new Date(-5 * HOUR), new Date(100 * HOUR)], series), []);
  });
});

describe('statsService.splitByTime', () => {
  it('counts views before and after the split moment exactly (the split belongs to "after")', () => {
    const times = [new Date(1 * HOUR), new Date(2 * HOUR), new Date(5 * HOUR), new Date(9 * HOUR)];
    assert.deepStrictEqual(splitByTime(times, 5 * HOUR), { before: 2, after: 2 });
    assert.deepStrictEqual(splitByTime([], 5 * HOUR), { before: 0, after: 0 });
  });
});

describe('statsService.buildKpis', () => {
  it('shows total, and a before/after card only when there was an update', () => {
    const withSplit = buildKpis({ total: 20, peak: 10, updateCount: 1, split: { before: 8, after: 12 } });
    assert.strictEqual(withSplit[0].value, '20');
    assert.ok(withSplit.some(k => k.label.includes('אחרי/לפני'))); // before/after card present

    const noSplit = buildKpis({ total: 20, peak: 10, updateCount: 0, split: null });
    assert.ok(!noSplit.some(k => k.label.includes('אחרי/לפני'))); // none without updates
  });
});

// The "updates published" count comes from the article's version (liveVersion.version - 1),
// not from counting approval-log rows. Models are mocked, so no database.
describe('statsService.getArticleStats — update count comes from liveVersion.version', () => {
  const UsageEvent = require('../models/UsageEvent');
  const OperationalLog = require('../models/OperationalLog');
  const Article = require('../models/Article');
  const { getArticleStats } = require('../services/statsService');
  const ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

  function mockQuery(rows) {
    const q = { select: () => q, sort: () => q, lean: () => Promise.resolve(rows) };
    return q;
  }
  function mockDoc(doc) {
    const q = { select: () => q, lean: () => Promise.resolve(doc) };
    return q;
  }
  const realViewFind = UsageEvent.find;
  const realLogFind = OperationalLog.find;
  const realById = Article.findById;
  function withData(views, approvals, versionNo, run) {
    UsageEvent.find = () => mockQuery(views);
    OperationalLog.find = () => mockQuery(approvals);
    Article.findById = () => mockDoc({ liveVersion: { version: versionNo } });
    return Promise.resolve()
      .then(run)
      .finally(() => { UsageEvent.find = realViewFind; OperationalLog.find = realLogFind; Article.findById = realById; });
  }
  const view = ms => ({ createdAt: new Date(ms) });
  const approval = ms => ({ message: `Editor approved and published article ${ID}`, createdAt: new Date(ms) });
  const updatesKpi = stats => stats.kpis.find(k => k.label.includes('עדכונים')).value;

  it('version 1 (just published) = 0 updates, no markers', () => {
    return withData([view(0), view(5 * DAY)], [approval(0)], 1, async () => {
      const stats = await getArticleStats(ID);
      assert.strictEqual(updatesKpi(stats), '0');
      assert.strictEqual(stats.updates.length, 0);
    });
  });

  it('version 3 = 2 updates', () => {
    return withData([view(0), view(14 * DAY)], [approval(0), approval(6 * DAY), approval(10 * DAY)], 3, async () => {
      assert.strictEqual(updatesKpi(await getArticleStats(ID)), '2');
    });
  });

  it('version 3 still counts 2 even when the initial publish was never logged (seeded article)', () => {
    // Only one approval log (a real republish), but the article version says 2 updates
    return withData([view(0), view(14 * DAY)], [approval(10 * DAY)], 3, async () => {
      assert.strictEqual(updatesKpi(await getArticleStats(ID)), '2');
    });
  });
});
