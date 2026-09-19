'use strict';

/**
 * Demo view data — Member 5 (Phase 10 contribution).
 * ---------------------------------------------------------------------------
 * Generates realistic view counts over time (daily buckets) for the published
 * articles, so the Impact Analytics dashboard has data to show. Also marks
 * update-publish-points: each article's publish day, plus an extra point for
 * "continuation" articles (an update after publication).
 *
 * It writes ONLY to the viewstats collection and updates each Article's `views`
 * counter. It does not change article content.
 *
 * Usage:
 *   node scripts/seed-viewstats.js               # generate (last 120 days)
 *   node scripts/seed-viewstats.js --days 90     # custom window
 *   node scripts/seed-viewstats.js --clear       # remove all view data
 * ---------------------------------------------------------------------------
 */

const path = require('node:path');
const mongoose = require('mongoose');
const Article = require('../models/Article');
const ViewStat = require('../models/ViewStat');

try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* default below */ }
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/the_daily_web';

const argv = process.argv.slice(2);
const CLEAR = argv.includes('--clear');
const daysArgIdx = argv.indexOf('--days');
const WINDOW_DAYS = daysArgIdx >= 0 ? Math.max(7, parseInt(argv[daysArgIdx + 1], 10) || 120) : 120;

const dayMs = 24 * 60 * 60 * 1000;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅  Connected:', MONGODB_URI);

    if (CLEAR) {
      const r = await ViewStat.deleteMany({});
      await Article.updateMany({}, { $set: { views: 0 } });
      console.log(`🧹  Removed ${r.deletedCount} view-stat bucket(s) and reset counters.`);
      await mongoose.disconnect();
      return console.log('✅  Done.');
    }

    // fresh start so re-runs are deterministic in volume
    await ViewStat.deleteMany({});

    const articles = await Article.find({ status: 'published' })
      .select('_id publishedAt isContinuation')
      .lean();
    console.log(`Generating view data for ${articles.length} published articles over ${WINDOW_DAYS} days...`);

    const todayBucket = ViewStat.dayBucket(new Date());
    const windowStart = new Date(todayBucket.getTime() - WINDOW_DAYS * dayMs);

    const viewOps = [];
    const articleViewTotals = [];

    for (const a of articles) {
      const pubDay = a.publishedAt ? ViewStat.dayBucket(a.publishedAt) : windowStart;
      const start = new Date(Math.max(pubDay.getTime(), windowStart.getTime()));
      const base = randInt(2, 60); // article popularity
      let total = 0;

      for (let t = start.getTime(); t <= todayBucket.getTime(); t += dayMs) {
        if (Math.random() < 0.45) continue; // not every day has views
        const ageDays = (todayBucket.getTime() - t) / dayMs;
        const decay = Math.max(0.15, 1 - ageDays / (WINDOW_DAYS * 1.5)); // newer days a bit busier
        const count = Math.max(1, Math.round(base * decay * (0.4 + Math.random())));
        total += count;
        viewOps.push({
          updateOne: {
            filter: { articleId: a._id, day: new Date(t) },
            update: { $set: { count }, $setOnInsert: { articleId: a._id, day: new Date(t) } },
            upsert: true,
          },
        });
      }

      // publish points: the publish day, and an extra one for continuations
      const publishPoints = new Set([pubDay.getTime()]);
      if (a.isContinuation) {
        const span = todayBucket.getTime() - start.getTime();
        if (span > 0) publishPoints.add(start.getTime() + Math.floor(span * (0.4 + Math.random() * 0.3)));
      }
      for (const ptRaw of publishPoints) {
        const pt = ViewStat.dayBucket(new Date(ptRaw)).getTime();
        if (pt < windowStart.getTime() || pt > todayBucket.getTime()) continue;
        viewOps.push({
          updateOne: {
            filter: { articleId: a._id, day: new Date(pt) },
            update: { $set: { isUpdatePublishPoint: true }, $setOnInsert: { articleId: a._id, day: new Date(pt) } },
            upsert: true,
          },
        });
      }

      articleViewTotals.push({ updateOne: { filter: { _id: a._id }, update: { $set: { views: total } } } });
    }

    console.log(`Writing ${viewOps.length} bucket operations...`);
    // write in chunks to keep each bulkWrite reasonable
    const chunk = 2000;
    for (let i = 0; i < viewOps.length; i += chunk) {
      await ViewStat.bulkWrite(viewOps.slice(i, i + chunk), { ordered: false });
    }
    for (let i = 0; i < articleViewTotals.length; i += chunk) {
      await Article.bulkWrite(articleViewTotals.slice(i, i + chunk), { ordered: false });
    }

    const totalBuckets = await ViewStat.countDocuments();
    const totalViews = (await ViewStat.aggregate([{ $group: { _id: null, t: { $sum: '$count' } } }]))[0]?.t || 0;
    const publishPoints = await ViewStat.countDocuments({ isUpdatePublishPoint: true });
    console.log('\n📊  View data created:');
    console.log(`   buckets: ${totalBuckets}`);
    console.log(`   total views: ${totalViews.toLocaleString('en-US')}`);
    console.log(`   publish points marked: ${publishPoints}`);

    await mongoose.disconnect();
    console.log('\n✅  Done.');
  } catch (err) {
    console.error('💥  View seed failed:', err.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
})();
