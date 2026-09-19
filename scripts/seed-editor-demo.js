'use strict';

/**
 * Editor demo data — adds a handful of articles in the various states so the
 * Editor screen (Phase 6) has something to act on (approve / return / edit).
 * ---------------------------------------------------------------------------
 * • It does NOT touch the 500 seeded articles.
 * • It is idempotent: re-running upserts the same demo items (they use a
 *   dedicated legacyId range starting at 900001), so no duplicates.
 * • Remove them anytime with:  node scripts/seed-editor-demo.js --clear
 *
 * Usage:
 *   node scripts/seed-editor-demo.js          # add / refresh the demo items
 *   node scripts/seed-editor-demo.js --clear  # remove only the demo items
 * ---------------------------------------------------------------------------
 */

const path = require('node:path');
const mongoose = require('mongoose');
const Article = require('../models/Article');

try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* default below */ }
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/the_daily_web';

const CLEAR = process.argv.slice(2).includes('--clear');
const DEMO_TAG = 'demo-editor';
const BASE = 900001; // dedicated legacyId range for demo items

const demo = [
  {
    legacyId: BASE + 1, status: 'pending', category: 'טכנולוגיה',
    title: '[הדגמה] סטארטאפ ישראלי גייס 40 מיליון דולר',
    summary: 'סבב גיוס חדש לחברת בינה מלאכותית מתל אביב.',
    content: 'חברת הסטארטאפ הישראלית הודיעה היום על סבב גיוס בהיקף 40 מיליון דולר...\n\n(כתבה זו ממתינה לאישור העורך — אפשר לאשר, לערוך או להחזיר לכתב.)',
  },
  {
    legacyId: BASE + 2, status: 'pending', category: 'ספורט',
    title: '[הדגמה] הנבחרת העפילה לגמר',
    summary: 'ניצחון דרמטי בהארכה שלח את הנבחרת לגמר.',
    content: 'בערב דרמטי, הנבחרת גברה על יריבתה בהארכה ועלתה לגמר...\n\n(ממתינה לאישור העורך.)',
  },
  {
    legacyId: BASE + 3, status: 'draft', category: 'כלכלה',
    title: '[הדגמה] טיוטה — סקירת שוק ההון',
    summary: '',
    content: 'טיוטה שהכתב עדיין עובד עליה. העורך רואה אותה אך אינה ממתינה לאישור.',
  },
  {
    legacyId: BASE + 4, status: 'returned', category: 'חדשות',
    title: '[הדגמה] כתבה שהוחזרה לתיקונים',
    summary: 'דוגמה לכתבה עם הערת עורך.',
    content: 'תוכן הכתבה שהוחזרה לכתב.',
    editorNote: 'נא להוסיף מקורות ולתקן את הכותרת לפני הגשה חוזרת.',
  },
  {
    legacyId: BASE + 5, status: 'published', category: 'פוליטיקה',
    title: '[הדגמה] כתבה מפורסמת עם עדכון ממתין',
    summary: 'הגרסה המפורסמת שהקוראים רואים כרגע.',
    content: 'זהו התוכן המפורסם שהקוראים רואים כרגע. \n\n(לכתבה יש גרסת עדכון הממתינה לאישור — בחר אותה במסך העורך כדי לראות השוואה בין "מפורסם כרגע" ל"ממתין".)',
    hasPendingUpdate: true,
    pending: {
      title: '[הדגמה] כתבה מפורסמת — כותרת מעודכנת',
      summary: 'תקציר מעודכן.',
      content: 'זהו התוכן החדש והמעודכן. רק אישור העורך יהפוך אותו לגרסה שהקוראים יראו.',
      submittedAt: new Date(),
    },
  },
  {
    legacyId: BASE + 6, status: 'published', category: 'בריאות',
    title: '[הדגמה] הנחיות בריאות — עם תיקון ממתין',
    summary: 'גרסה מפורסמת.',
    content: 'ההנחיות המפורסמות כרגע.',
    hasPendingUpdate: true,
    pending: {
      title: '[הדגמה] הנחיות בריאות — גרסה מתוקנת',
      summary: 'גרסה מתוקנת.',
      content: 'הנחיות מעודכנות לאחר תיקון של הכתב.',
      submittedAt: new Date(),
    },
  },
];

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅  Connected:', MONGODB_URI);

    if (CLEAR) {
      const r = await Article.deleteMany({ legacyId: { $gte: BASE, $lt: BASE + 1000 } });
      console.log(`🧹  Removed ${r.deletedCount} demo article(s).`);
    } else {
      const ops = demo.map((d) => ({
        updateOne: {
          filter: { legacyId: d.legacyId },
          update: {
            $set: {
              ...d,
              author: 'כתב הדגמה',
              tags: [DEMO_TAG],
              publishedAt: d.status === 'published' ? new Date() : undefined,
            },
          },
          upsert: true,
        },
      }));
      const res = await Article.bulkWrite(ops, { ordered: false });
      console.log(`📝  Demo upsert — inserted: ${res.upsertedCount}, modified: ${res.modifiedCount}`);
      const byStatus = await Article.aggregate([
        { $match: { legacyId: { $gte: BASE, $lt: BASE + 1000 } } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]);
      console.log('📌  Demo items by status:', Object.fromEntries(byStatus.map((x) => [x._id, x.n])));
    }

    await mongoose.disconnect();
    console.log('✅  Done.');
  } catch (err) {
    console.error('💥  Demo seed failed:', err.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
})();
