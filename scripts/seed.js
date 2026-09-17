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

// Deterministic mix of statuses: 50% published, 20% pending, 10% returned, 20% draft
function statusFor(index) {
  const slot = index % 10;
  if (slot < 5) return STATUS.PUBLISHED;
  if (slot < 7) return STATUS.PENDING;
  if (slot < 8) return STATUS.RETURNED;
  return STATUS.DRAFT;
}

// Spreads "last updated" over the past 30 days, with a few very recent ones
function updatedAtFor(index, now) {
  if (index % 25 === 0) return new Date(now - ((index % 50) + 3) * MINUTE);
  if (index % 25 === 1) return new Date(now - ((index % 5) + 1) * HOUR);
  return new Date(now - ((index * 7919) % (30 * 24 * 60)) * MINUTE);
}

function buildArticle(raw, index, authors, editor, now) {
  const status = statusFor(index);
  const updatedAt = updatedAtFor(index, now);

  // Returned articles, and some published ones that were fixed before approval, have editor notes
  let returnedCount = 0;
  if (status === STATUS.RETURNED) returnedCount = 1 + (index % 2);
  else if (status === STATUS.PUBLISHED && index % 20 === 3) returnedCount = 1;

  const editorNotes = Array.from({ length: returnedCount }, (_, n) => ({
    text: EDITOR_NOTES[(index + n) % EDITOR_NOTES.length],
    by: editor._id,
    createdAt: new Date(updatedAt - (n + 1) * HOUR),
  }));

  const isPublished = status === STATUS.PUBLISHED;

  return {
    legacyId: raw.id,
    title: raw.title,
    summary: raw.summary || '',
    body: raw.body || '',
    category: raw.category,
    tags: raw.tags || [],
    relation: raw.relation || null,
    // Blocks of 10 per author, so every author gets the full mix of statuses
    author: authors[Math.floor(index / 10) % authors.length]._id,
    status,
    editorNotes,
    returnedCount,
    views: isPublished ? ((index * 2654435761) % 12000) + 150 : 0,
    publishedAt: isPublished ? new Date(updatedAt - ((index % 48) + 1) * HOUR) : null,
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
