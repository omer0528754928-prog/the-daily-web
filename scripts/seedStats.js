// Fills the monitoring collections with demo data for the editor's Impact Analytics:
// per published article, a stream of "article_view" events over the last two weeks,
// plus an initial-publish approval and zero-to-two update approvals in the operational log.
// The real app records the same events at runtime; this just gives the graph history to show.
// Safe to run more than once: it clears the demo events for each article before re-creating them.
// Usage: npm run seed:stats

process.loadEnvFile();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Article = require('../models/Article');
const UsageEvent = require('../models/UsageEvent');
const OperationalLog = require('../models/OperationalLog');

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;
const MAX_ARTICLES = 8; // enough articles to demo the picker, without a huge insert

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

// A day's view count: a gentle rise over the window, with a clear jump after each
// update that has already been published by that day. Returns a whole number.
function viewsForDay(dayIndex, updateDays) {
  let rate = 8 + dayIndex * 4; // baseline interest grows over the two weeks
  for (const updateDay of updateDays) {
    if (dayIndex >= updateDay) rate += 45; // a published update brings a burst of readers
  }
  return randomInt(Math.round(rate * 0.7), Math.round(rate * 1.3));
}

async function seedArticle(article, updateDays) {
  const id = article._id;
  const now = Date.now();
  const windowStart = now - WINDOW_DAYS * DAY;

  // Clear previous demo data for this article so the script is repeatable
  await UsageEvent.deleteMany({ type: 'article_view', articleId: id });
  await OperationalLog.deleteMany({ source: 'editor', event: 'article_approved', message: new RegExp(String(id)) });

  // View events: spread each day's count at random times within that day
  const views = [];
  for (let day = 0; day < WINDOW_DAYS; day++) {
    const count = viewsForDay(day, updateDays);
    for (let i = 0; i < count; i++) {
      const createdAt = new Date(windowStart + day * DAY + randomInt(0, DAY - 1));
      views.push({ type: 'article_view', source: 'article_page', articleId: id, createdAt });
    }
  }
  await UsageEvent.insertMany(views);

  // Approval log entries, same shape the editor flow writes. Day 0 is the initial
  // publish (the stats skip it); the rest are updates, so the graph shows them as
  // "update 1", "update 2", ... and the "updates published" count is 0 for a plain publish.
  const approvalDays = [0, ...updateDays];
  const approvals = approvalDays.map(day => ({
    level: 'info',
    source: 'editor',
    event: 'article_approved',
    message: `Editor approved and published article ${id}`,
    createdAt: new Date(windowStart + day * DAY + 12 * 60 * 60 * 1000), // mid-day
  }));
  await OperationalLog.insertMany(approvals);

  return views.length;
}

async function run() {
  await connectDB();

  const articles = await Article.find({ 'liveVersion.publishedAt': { $ne: null } })
    .select('title')
    .sort({ 'liveVersion.publishedAt': -1 })
    .limit(MAX_ARTICLES)
    .lean();

  if (!articles.length) {
    console.log('No published articles found. Run "npm run seed" first, then this script.');
    await mongoose.disconnect();
    return;
  }

  let totalViews = 0;
  for (let i = 0; i < articles.length; i++) {
    // Vary the update points per article: some get two updates, some one
    // Mix of articles with 0, 1 and 2 updates after publishing, to show the full range
    const updateDays = i % 3 === 0 ? [] : (i % 3 === 1 ? [6] : [6, 10]);
    const created = await seedArticle(articles[i], updateDays);
    totalViews += created;
    console.log(`  ${articles[i].title}: ${created} views, ${updateDays.length} update point(s)`);
  }

  console.log(`\nDone. ${articles.length} articles, ${totalViews} view events in the last ${WINDOW_DAYS} days.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
