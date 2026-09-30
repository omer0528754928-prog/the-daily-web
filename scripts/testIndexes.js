process.loadEnvFile();                     // reads MONGODB_URI from .env, like app.js does

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Article = require('../models/Article');
const feedService = require('../services/feedService');
const { toFeedCard } = require('../presenters/feedArticlePresenter');

const BY_DATE = { 'liveVersion.publishedAt': -1, _id: -1 };
const BY_VIEWS = { views: -1, _id: -1 };

// Walks down the plan tree: e.g. "LIMIT <- FETCH <- IXSCAN(indexName)"
function planStages(plan) {
  const names = [];
  let node = plan;
  while (node) {
    names.push(node.indexName ? `${node.stage}(${node.indexName})` : node.stage);
    node = node.inputStage || node.inputStages?.[0];
  }
  return names.join(' <- ');
}

// Runs the query in MongoDB and prints which index it used (IXSCAN = index, COLLSCAN = no index)
async function check(label, filter, sort) {
  let query = Article.find(filter).limit(20);
  if (sort) query = query.sort(sort);

  const result = await query.explain('executionStats');
  const plan = result.queryPlanner.winningPlan;
  const stats = result.executionStats;

  console.log(`\n${label}`);
  console.log(`  filter:   ${JSON.stringify(filter)}`);
  console.log(`  plan:     ${planStages(plan)}`);
  console.log(`  examined: ${stats.totalDocsExamined} docs, returned ${stats.nReturned}`);
}

// 2.5: an article edited after publishing must show its live title in the feed, never the draft
async function checkNoDraftLeak() {
  const edited = await Article.findOne(
    { status: 'pending', liveVersion: { $ne: null } },
    { title: 1, 'liveVersion.title': 1 }
  ).lean();

  console.log('\n2.5 no drafts leak');
  if (!edited) return console.log('  SKIP: no pending article with a live version');

  // Page through the whole feed until the article shows up
  let item;
  let json = '';
  for (let skip = 0; ; skip += 50) {
    const { items, hasMore } = await feedService.listFeed({ limit: 50, skip });
    json += JSON.stringify(items);
    item ??= items.find(i => i._id.equals(edited._id));
    if (!hasMore) break;
  }

  const results = {
    'article is in the feed': !!item,
    'feed shows the live title': item?.liveVersion?.title === edited.liveVersion.title,
    'no top-level title on the item': item && !('title' in item),
    'draft title appears nowhere in the feed': !json.includes(JSON.stringify(edited.title).slice(1, -1)),
  };

  console.log(`  draft: ${edited.title}`);
  console.log(`  live:  ${edited.liveVersion.title}`);
  for (const [name, ok] of Object.entries(results)) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

// 3: toFeedCard turns database articles into flat cards with display strings
async function checkFeedCards() {
  const { items } = await feedService.listFeed({ limit: 5 });
  const cards = items.map(toFeedCard);

  console.log('\n3 feed cards');
  if (!cards.length) return console.log('  SKIP: no published articles');
  console.dir(cards, { depth: null });

  const FIELDS = ['id', 'title', 'summary', 'category', 'image', 'reporter', 'date', 'views'];
  const missing = cards.flatMap(card => FIELDS.filter(f => card[f] === undefined).map(f => `${card.id}.${f}`));

  const results = {
    'id is a string': cards.every(c => typeof c.id === 'string'),
    'no _id': cards.every(c => !('_id' in c)),
    'no nested liveVersion': cards.every(c => !('liveVersion' in c)),
    'date is a display string': cards.every(c => typeof c.date === 'string'),
    'views is a display string': cards.every(c => typeof c.views === 'string'),
    [`no undefined fields${missing.length ? ` (${missing.join(', ')})` : ''}`]: !missing.length,
    'deleted author does not crash': (() => {
      try { return toFeedCard({ ...items[0], author: null }).reporter === undefined; } catch { return false; }
    })(),
  };

  for (const [name, ok] of Object.entries(results)) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const main = async () => {
  await connectDB();

  // await check('date', feedService.buildFeedFilter(), BY_DATE);
  // await check('popular', feedService.buildFeedFilter(), BY_VIEWS);
  // await check('category + date', feedService.buildFeedFilter({ category: 'ספורט' }), BY_DATE);
  // await check('category + popular', feedService.buildFeedFilter({ category: 'ספורט' }), BY_VIEWS);
  // await check('search', feedService.buildFeedFilter({ q: 'בורסה' }), BY_DATE);
  // await check('category + search', feedService.buildFeedFilter({ category: 'כלכלה', q: 'בורסה' }), BY_DATE);

  const answer= await feedService.listPopular(1);
  console.log(answer);
  console.dir(answer, { depth: null });

  // await checkNoDraftLeak();

  await checkFeedCards();


  await mongoose.disconnect();
};

main().catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
