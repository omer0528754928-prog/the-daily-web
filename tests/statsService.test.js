// Tests the pure bucketing/mapping logic of services/statsService.js — the maths that
// turns raw view timestamps and update times into the series the Impact Analytics graph
// draws. No database: only node:test + node:assert.
// Run with: npm test

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { bucketByTime, bucketIndex, updateBuckets, buildKpis } = require('../services/statsService');

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

describe('statsService.buildKpis', () => {
  it('reports total views, and a before/after only when there was an update', () => {
    const series = { counts: [2, 3, 5, 10] };
    const withUpdate = buildKpis(series, [2]); // last update at bucket 2
    assert.strictEqual(withUpdate[0].value, '20');                 // total = 2+3+5+10
    assert.ok(withUpdate.some(k => k.label.includes('אחרי/לפני'))); // before/after card present

    const noUpdate = buildKpis(series, []);
    assert.ok(!noUpdate.some(k => k.label.includes('אחרי/לפני'))); // none without updates
  });
});
