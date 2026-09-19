// Fills MongoDB with users and the articles from articlesDB/articles.json.
// Safe to run more than once: users are matched by username, articles by legacyId.
// Usage: npm run seed

process.loadEnvFile();

const path = require('node:path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Article = require('../models/Article');
const { STATUS } = require('../config/articleStatus');

const { ROLES } = User;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const USERS = [
  { username: 'reporter01', name: 'דנה לוי', role: ROLES.REPORTER },
  { username: 'reporter02', name: 'עומר שגב', role: ROLES.REPORTER },
  { username: 'reporter03', name: 'רותם אבן', role: ROLES.REPORTER },
  { username: 'reporter04', name: 'נועה גל', role: ROLES.REPORTER },
  { username: 'editor01', name: 'איתן ברק', role: ROLES.EDITOR },
];

const EDITOR_NOTES = [
  'חסר אימות מול דובר העירייה; לקצר את הפסקה השלישית',
  'הכותרת ארוכה מדי לפיד — לקצר לשבע מילים לכל היותר',
  'נא להוסיף כתובית וקרדיט צילום לתמונה הראשית',
  'יש לציין מקור לנתונים שמופיעים בפסקה השנייה',
];

// Every situation an article can be in, so each reporter flow can be tried right away
const SITUATION = Object.freeze({
  PUBLISHED: 'published',                   // public, nothing changed since approval
  PUBLISHED_WITH_UNSENT_EDIT: 'publishedEdit', // public sees the old version; reporter saved changes
  PENDING_UPDATE: 'pendingUpdate',          // public sees the old version; changes wait for the editor
  PENDING_NEW: 'pendingNew',                // never published, waiting for the editor
  RETURNED_NEW: 'returnedNew',              // never published, sent back with notes
  RETURNED_UPDATE: 'returnedUpdate',        // public sees the old version; changes sent back with notes
  DRAFT: 'draft',                           // never sent
});

// Out of every 10 articles: 3 published, 1 of each other situation, 2 drafts
function situationFor(index) {
  return [
    SITUATION.PUBLISHED, SITUATION.PUBLISHED, SITUATION.PUBLISHED,
    SITUATION.PUBLISHED_WITH_UNSENT_EDIT, SITUATION.PENDING_UPDATE, SITUATION.PENDING_NEW,
    SITUATION.RETURNED_NEW, SITUATION.RETURNED_UPDATE, SITUATION.DRAFT, SITUATION.DRAFT,
  ][index % 10];
}

const STATUS_BY_SITUATION = {
  [SITUATION.PUBLISHED]: STATUS.PUBLISHED,
  [SITUATION.PUBLISHED_WITH_UNSENT_EDIT]: STATUS.PUBLISHED,
  [SITUATION.PENDING_UPDATE]: STATUS.PENDING,
  [SITUATION.PENDING_NEW]: STATUS.PENDING,
  [SITUATION.RETURNED_NEW]: STATUS.RETURNED,
  [SITUATION.RETURNED_UPDATE]: STATUS.RETURNED,
  [SITUATION.DRAFT]: STATUS.DRAFT,
};

const WAS_PUBLISHED = new Set([
  SITUATION.PUBLISHED, SITUATION.PUBLISHED_WITH_UNSENT_EDIT, SITUATION.PENDING_UPDATE, SITUATION.RETURNED_UPDATE,
]);

// Spreads "last updated" over the past 30 days, with a few very recent ones
function updatedAtFor(index, now) {
  if (index % 25 === 0) return new Date(now - ((index % 50) + 3) * MINUTE);
  if (index % 25 === 1) return new Date(now - ((index % 5) + 1) * HOUR);
  return new Date(now - ((index * 7919) % (30 * 24 * 60)) * MINUTE);
}

function buildArticle(raw, index, authors, editor, now) {
  const situation = situationFor(index);
  const status = STATUS_BY_SITUATION[situation];
  const updatedAt = updatedAtFor(index, now);
  const wasPublished = WAS_PUBLISHED.has(situation);
  const hasNewerVersion = wasPublished && situation !== SITUATION.PUBLISHED;

  const original = {
    title: raw.title,
    summary: raw.summary || '',
    body: raw.body || '',
    category: raw.category,
    image: null,
  };

  // The public copy, approved by the editor (versions 1-3)
  const liveVersion = wasPublished
    ? { ...original, version: 1 + (index % 3), publishedAt: new Date(updatedAt - ((index % 48) + 24) * HOUR) }
    : null;

  // The working copy differs from the public one when the reporter changed it after approval
  const workingCopy = hasNewerVersion
    ? { ...original, title: `${original.title} (עדכון)`, body: `${original.body}\n\nעדכון: נוספו פרטים חדשים מהשעות האחרונות.` }
    : original;
  const version = liveVersion ? liveVersion.version + (hasNewerVersion ? 1 : 0) : 1;

  // Returned articles have notes; some published ones were returned once before approval
  let returnedCount = 0;
  if (status === STATUS.RETURNED) returnedCount = 1 + (index % 2);
  else if (situation === SITUATION.PUBLISHED && index % 20 === 1) returnedCount = 1;

  const editorNotes = Array.from({ length: returnedCount }, (_, n) => ({
    text: EDITOR_NOTES[(index + n) % EDITOR_NOTES.length],
    by: editor._id,
    createdAt: new Date(updatedAt - (n + 1) * HOUR),
  }));

  return {
    legacyId: raw.id,
    ...workingCopy,
    version,
    tags: raw.tags || [],
    relation: raw.relation || null,
    // Blocks of 10 per author, so every author gets the full mix of situations
    author: authors[Math.floor(index / 10) % authors.length]._id,
    status,
    submittedAt: status === STATUS.PENDING || status === STATUS.RETURNED ? new Date(updatedAt - 2 * HOUR) : null,
    republishAt: null,
    editorNotes,
    returnedCount,
    views: liveVersion ? ((index * 2654435761) % 12000) + 150 : 0,
    liveVersion,
    createdAt: new Date(updatedAt - 3 * 24 * HOUR),
    updatedAt,
  };
}

async function seedUsers() {
  await User.bulkWrite(USERS.map(user => ({
    updateOne: { filter: { username: user.username }, update: { $set: user }, upsert: true },
  })));
  return User.find({ username: { $in: USERS.map(u => u.username) } }).lean();
}

async function seedArticles(users) {
  const rawArticles = require(path.join(__dirname, '../articlesDB/articles.json'));
  const authors = users.filter(u => u.role === ROLES.REPORTER).sort((a, b) => a.username.localeCompare(b.username));
  const editor = users.find(u => u.role === ROLES.EDITOR);
  const now = Date.now();

  await Article.bulkWrite(
    rawArticles.map((raw, index) => ({
      updateOne: {
        filter: { legacyId: raw.id },
        update: { $set: buildArticle(raw, index, authors, editor, now) },
        upsert: true,
        timestamps: false,
      },
    })),
  );

  // Remove the old top-level publishedAt field (now liveVersion.publishedAt).
  // Mongoose ignores fields that are not in the schema, so this goes to the collection directly.
  await Article.collection.updateMany({ publishedAt: { $exists: true } }, { $unset: { publishedAt: '' } });

  // Second pass: link each article to its parent story, now that every article has an _id
  const idByLegacyId = new Map(
    (await Article.find({ legacyId: { $ne: null } }).select('legacyId').lean()).map(a => [a.legacyId, a._id]),
  );
  const parentLinks = rawArticles
    .filter(raw => raw.parent_id && idByLegacyId.has(raw.parent_id))
    .map(raw => ({
      updateOne: {
        filter: { legacyId: raw.id },
        update: { $set: { parent: idByLegacyId.get(raw.parent_id) } },
        timestamps: false,
      },
    }));
  if (parentLinks.length) await Article.bulkWrite(parentLinks);

  return rawArticles.length;
}

async function seed() {
  await connectDB();
  await Promise.all([User.syncIndexes(), Article.syncIndexes()]);

  const users = await seedUsers();
  const articleCount = await seedArticles(users);

  console.log(`Seeded ${users.length} users and ${articleCount} articles`);
  await mongoose.disconnect();
}

seed().catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
