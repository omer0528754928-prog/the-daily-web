'use strict';

/**
 * Seed script  —  load the 500 synthetic articles into MongoDB.
 * ---------------------------------------------------------------------------
 * Source : articlesDB/articles.json  (500 Hebrew news items)
 * Target : the `articles` collection, via the Article model.
 *
 * Usage:
 *   node scripts/seed-articles.js            # upsert all 500 (idempotent)
 *   node scripts/seed-articles.js --fresh    # wipe the collection first, then insert
 *   node scripts/seed-articles.js --dry-run  # validate every record WITHOUT a DB
 *
 * Connection string is read from MONGODB_URI (.env), falling back to a local
 * default. Re-running is safe: records are upserted keyed on their legacyId,
 * so you never get duplicates.
 * ---------------------------------------------------------------------------
 */

const path = require('node:path');
const fs = require('node:fs');
const mongoose = require('mongoose');
const Article = require('../models/Article');

// --- config -----------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FRESH = args.includes('--fresh');

// Load .env if present (Node built-in). Tolerate a missing file so --dry-run
// works before Mongo is even installed.
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  /* no .env yet — fall back to the default URI below */
}

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/the_daily_web';

const DATA_FILE = path.join(__dirname, '..', 'articlesDB', 'articles.json');

// --- helpers ----------------------------------------------------------------

/** Build a short teaser from the body when the source summary is empty. */
function makeSummary(rawSummary, body) {
  const s = (rawSummary || '').trim();
  if (s) return s;
  const clean = (body || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= 180) return clean;
  // cut on a word boundary near 180 chars
  return clean.slice(0, 180).replace(/\s+\S*$/, '') + '…';
}

/** Map one raw JSON record to an Article document shape. */
function mapRecord(r) {
  return {
    legacyId: r.id,
    title: (r.title || '').trim(),
    summary: makeSummary(r.summary, r.body),
    content: r.body || '',
    category: (r.category || 'חדשות').trim(),
    tags: Array.isArray(r.tags) ? r.tags : [],
    status: 'published', // the synthetic items represent live, published news
    author: 'מערכת The Daily Web',
    views: 0,
    publishedAt: r.created_at ? new Date(r.created_at) : new Date(),
    relation: r.relation === 'continuation' || r.relation === 'ripple' ? r.relation : null,
    isContinuation: !!r.is_continuation,
    // parentId is resolved in a second pass (legacyId -> _id); keep the raw
    // parent legacy id here temporarily.
    _parentLegacyId: r.parent_id ?? null,
  };
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Data file not found: ${DATA_FILE}`);
  }
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('articles.json is not an array');
  return raw;
}

function report(title, obj) {
  console.log(`\n${title}`);
  for (const [k, v] of Object.entries(obj)) console.log(`   ${k}: ${v}`);
}

// --- dry run: validate every record against the schema, no DB ---------------
async function dryRun(rows) {
  console.log(`\n🔎  DRY RUN — validating ${rows.length} records against the Article schema (no DB connection)`);
  let ok = 0;
  const errors = [];
  const byCategory = {};
  for (const r of rows) {
    const mapped = mapRecord(r);
    delete mapped._parentLegacyId; // not a schema field
    const doc = new Article(mapped);
    try {
      await doc.validate();
      ok += 1;
      byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
    } catch (err) {
      errors.push({ id: r.id, message: err.message });
    }
  }
  report('✅  Validation result', {
    total: rows.length,
    valid: ok,
    invalid: errors.length,
  });
  report('📚  By category', byCategory);
  if (errors.length) {
    console.log('\n❌  First few validation errors:');
    for (const e of errors.slice(0, 5)) console.log(`   #${e.id}: ${e.message}`);
    process.exitCode = 1;
  } else {
    console.log('\n🎉  All records are valid. Ready to seed a live database.');
  }
}

// --- live seed: connect, upsert, resolve parents ----------------------------
async function liveSeed(rows) {
  console.log(`\n🔌  Connecting to MongoDB: ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI);
  console.log('✅  Connected.');

  if (FRESH) {
    const del = await Article.deleteMany({});
    console.log(`🧹  --fresh: removed ${del.deletedCount} existing article(s).`);
  }

  const mapped = rows.map(mapRecord);

  // Pass 1 — upsert every article keyed on legacyId (idempotent).
  const ops = mapped.map((m) => {
    const { _parentLegacyId, ...doc } = m;
    return {
      updateOne: {
        filter: { legacyId: doc.legacyId },
        update: { $set: doc },
        upsert: true,
      },
    };
  });
  const res = await Article.bulkWrite(ops, { ordered: false });
  console.log(
    `\n📝  Upsert done — inserted: ${res.upsertedCount}, matched: ${res.matchedCount}, modified: ${res.modifiedCount}`
  );

  // Pass 2 — resolve parentId (legacyId -> _id) for the update/relation chain.
  const all = await Article.find({}, { _id: 1, legacyId: 1 }).lean();
  const byLegacy = new Map(all.map((a) => [a.legacyId, a._id]));
  let linked = 0;
  const parentOps = [];
  for (const m of mapped) {
    if (m._parentLegacyId != null && byLegacy.has(m._parentLegacyId)) {
      parentOps.push({
        updateOne: {
          filter: { legacyId: m.legacyId },
          update: { $set: { parentId: byLegacy.get(m._parentLegacyId) } },
        },
      });
      linked += 1;
    }
  }
  if (parentOps.length) await Article.bulkWrite(parentOps, { ordered: false });
  console.log(`🔗  Linked ${linked} article(s) to their parent (update/relation chain).`);

  // Make sure declared indexes exist.
  await Article.syncIndexes();
  console.log('🧭  Indexes synced.');

  // --- summary ---
  const total = await Article.countDocuments();
  const byStatus = await Article.aggregate([
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const byCategory = await Article.aggregate([
    { $group: { _id: '$category', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  report('📊  Collection now contains', { totalArticles: total });
  report('📌  By status', Object.fromEntries(byStatus.map((x) => [x._id, x.n])));
  report('📚  By category', Object.fromEntries(byCategory.map((x) => [x._id, x.n])));

  const sample = await Article.findOne({ isContinuation: true })
    .populate('parentId', 'title')
    .lean();
  if (sample) {
    console.log('\n🧪  Sample "continuation" article (update chain):');
    console.log(`   title : ${sample.title.slice(0, 60)}`);
    console.log(`   parent: ${sample.parentId ? sample.parentId.title.slice(0, 60) : '(none)'}`);
  }

  await mongoose.disconnect();
  console.log('\n✅  Done. Disconnected.');
}

// --- main -------------------------------------------------------------------
(async () => {
  try {
    const rows = loadData();
    console.log(`Loaded ${rows.length} raw records from articles.json`);
    if (DRY_RUN) await dryRun(rows);
    else await liveSeed(rows);
  } catch (err) {
    console.error('\n💥  Seed failed:', err.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
})();
