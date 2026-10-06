// Tests the shared article validator (validators/articleValidator.js) and the
// editor save path (services/editorService.js), which must enforce the SAME
// length limits as the reporter save path. No external libraries, no real DB:
// just node:test + node:assert, with the Mongoose model statics mocked.
// Run with: npm test

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { LIMITS, tooLongMessage, validateDraft, validateForSubmit } = require('../validators/articleValidator');
const CATEGORIES = require('../config/categories');

const CATEGORY = CATEGORIES[0];           // a valid category, so only the field under test can fail
const hebrew = n => 'א'.repeat(n);        // Hebrew text, to prove counting is by characters not bytes

// ---- the validator itself ----
describe('articleValidator – length limits (the single source of truth is LIMITS)', () => {
  it('title: 200 chars passes, 201 fails', () => {
    assert.strictEqual(validateForSubmit({ title: hebrew(200), body: 'x', category: CATEGORY }).errors.title, undefined);
    assert.strictEqual(validateForSubmit({ title: hebrew(201), body: 'x', category: CATEGORY }).errors.title, tooLongMessage(LIMITS.title));
  });

  it('summary: 500 chars passes, 501 fails', () => {
    assert.strictEqual(validateForSubmit({ title: 'ok', body: 'x', summary: hebrew(500), category: CATEGORY }).errors.summary, undefined);
    assert.strictEqual(validateForSubmit({ title: 'ok', body: 'x', summary: hebrew(501), category: CATEGORY }).errors.summary, tooLongMessage(LIMITS.summary));
  });

  it('body: 50000 chars passes (Hebrew), 50001 fails', () => {
    assert.strictEqual(validateForSubmit({ title: 'ok', body: hebrew(50000), category: CATEGORY }).errors.body, undefined);
    assert.strictEqual(validateForSubmit({ title: 'ok', body: hebrew(50001), category: CATEGORY }).errors.body, tooLongMessage(LIMITS.body));
  });

  it('empty title fails as a draft and on submit', () => {
    assert.strictEqual(validateDraft({ title: '', body: 'x', category: CATEGORY }).errors.title, 'Title is required');
    assert.strictEqual(validateForSubmit({ title: '', body: 'x', category: CATEGORY }).errors.title, 'Title is required');
  });

  it('empty body fails only on submit, not as a draft', () => {
    assert.strictEqual(validateDraft({ title: 'ok', body: '', category: CATEGORY }).errors.body, undefined);
    assert.strictEqual(validateForSubmit({ title: 'ok', body: '', category: CATEGORY }).errors.body, 'Body is required before sending to the editor');
  });
});

// ---- the editor save path uses that same validator ----
// editorService.editContent is the only place an editor rewrites article content.
// We give it a mocked Article model so no database is needed; we only check that
// an over-length title is refused with the shared message (not silently saved).
describe('editorService.editContent – blocks an over-length title like the reporter path', () => {
  const Article = require('../models/Article');
  const { STATUS } = require('../config/articleStatus');

  // A thenable that also answers .populate()/.lean(), matching how editContent reads the model
  function result(doc) {
    const p = Promise.resolve(doc);
    p.populate = () => p;
    p.lean = () => Promise.resolve(doc);
    return p;
  }

  let stored; // the one article "in the database"
  Article.findById = () => result(stored ? { ...stored } : null);
  Article.findOneAndUpdate = (filter, update) => {
    if (!stored || stored.status !== filter.status || stored.version !== filter.version) return result(null);
    return result({ ...stored, ...(update.$set || {}) });
  };

  const editorService = require('../services/editorService');
  const ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const pending = () => ({
    _id: ID, title: 'old', summary: '', body: 'old body',
    category: CATEGORY, image: null, version: 1, status: STATUS.PENDING, liveVersion: null,
  });

  it('rejects a 201-char title with status 400 and the shared "too long" message', async () => {
    stored = pending();
    await assert.rejects(
      () => editorService.editContent(ID, { title: hebrew(201), body: 'valid body', summary: '', category: CATEGORY }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.details.title, tooLongMessage(LIMITS.title));
        return true;
      },
    );
  });

  it('accepts a 200-char title (no validation error)', async () => {
    stored = pending();
    const saved = await editorService.editContent(ID, { title: hebrew(200), body: 'valid body', summary: '', category: CATEGORY });
    assert.strictEqual(saved.title, hebrew(200));
  });
});
