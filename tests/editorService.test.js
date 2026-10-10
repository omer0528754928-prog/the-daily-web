// Tests that the editor can return an already-published article for corrections,
// while the public (live) version is kept. The Mongoose model is mocked, no database.
// Run with: npm test

const { describe, it } = require('node:test');
const assert = require('node:assert');

const Article = require('../models/Article');
const { STATUS } = require('../config/articleStatus');

// A stand-in for a Mongoose result that also answers .lean()
function result(doc) {
  const p = Promise.resolve(doc);
  p.lean = () => Promise.resolve(doc);
  return p;
}

describe('editorService.returnToReporter — return a published article for corrections', () => {
  let stored; // the one article "in the database"
  Article.findById = () => result(stored ? { ...stored } : null);
  Article.findOneAndUpdate = (filter, update) => {
    if (!stored || stored.status !== filter.status || stored.version !== filter.version) return result(null);
    const doc = { ...stored, editorNotes: [...(stored.editorNotes || [])] };
    if (update.$set) Object.assign(doc, update.$set);
    if (update.$push && update.$push.editorNotes) doc.editorNotes.push(update.$push.editorNotes);
    if (update.$inc && update.$inc.returnedCount) doc.returnedCount = (doc.returnedCount || 0) + update.$inc.returnedCount;
    return result(doc);
  };

  const editorService = require('../services/editorService');
  const ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const published = (over) => ({
    _id: ID, status: STATUS.PUBLISHED, version: 2,
    editorNotes: [], returnedCount: 0, liveVersion: { title: 'public', version: 1 }, ...over,
  });

  it('published -> returned: status changes, note is added, the public version is kept', async () => {
    stored = published();
    const saved = await editorService.returnToReporter(ID, 'ed1', 'נא לתקן את הפסקה השנייה');
    assert.strictEqual(saved.status, STATUS.RETURNED);
    assert.strictEqual(saved.returnedCount, 1);
    assert.strictEqual(saved.editorNotes.length, 1);
    assert.strictEqual(saved.editorNotes[0].text, 'נא לתקן את הפסקה השנייה');
    assert.ok(saved.liveVersion, 'the public (live) version must stay');
  });

  it('a note is required when returning', async () => {
    stored = published();
    await assert.rejects(() => editorService.returnToReporter(ID, 'ed1', '   '), (e) => e.status === 400);
  });
});
