// Checks services/commentService.js against an in-memory stand-in for MongoDB
// (tests/helpers/fakeComments.js): saving, listing, editing and deleting comments.
// Run with: npm test

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { installFakeComments } = require('./helpers/fakeComments');
const commentService = require('../services/commentService');

const fake = installFakeComments();
const ARTICLE = new mongoose.Types.ObjectId();
const OTHER_ARTICLE = new mongoose.Types.ObjectId();

const rejectsWith = (promise, status) => assert.rejects(promise, error => error.status === status);

describe('commentService', () => {
  beforeEach(() => fake.reset());

  describe('createComment', () => {
    it('saves the comment trimmed, with the sender ip, and returns it without the ip', async () => {
      const comment = await commentService.createComment(ARTICLE, { name: ' יעל ', text: ' שלום ' }, { ip: '1.2.3.4' });
      assert.strictEqual(comment.authorName, 'יעל');
      assert.strictEqual(comment.text, 'שלום');
      assert.ok(!('ip' in comment));
      assert.strictEqual(fake.store[0].ip, '1.2.3.4');
    });

    it('saves an empty name as "אורח"', async () => {
      const comment = await commentService.createComment(ARTICLE, { name: '', text: 'שלום' });
      assert.strictEqual(comment.authorName, 'אורח');
    });

    it('throws 400 with details for invalid input, and saves nothing', async () => {
      await assert.rejects(commentService.createComment(ARTICLE, { text: '' }), error => {
        assert.strictEqual(error.status, 400);
        assert.ok(error.details.text);
        return true;
      });
      assert.strictEqual(fake.store.length, 0);
    });
  });

  describe('listForArticle', () => {
    it('returns one page, newest first, the total, and never the ip', async () => {
      fake.seed(ARTICLE, 25);
      fake.seed(OTHER_ARTICLE, 3);
      const { items, total } = await commentService.listForArticle(ARTICLE, { limit: 20, skip: 0 });
      assert.strictEqual(total, 25);
      assert.strictEqual(items.length, 20);
      assert.strictEqual(items[0].text, 'תגובה 24');
      assert.ok(items.every(c => !('ip' in c)));
      assert.deepStrictEqual(fake.queries[0].order, { createdAt: -1, _id: -1 });
    });

    it('skip loads the next page (for "load more")', async () => {
      fake.seed(ARTICLE, 25);
      const { items } = await commentService.listForArticle(ARTICLE, { limit: 20, skip: 20 });
      assert.deepStrictEqual(items.map(c => c.text), ['תגובה 4', 'תגובה 3', 'תגובה 2', 'תגובה 1', 'תגובה 0']);
    });
  });

  describe('updateComment (editors)', () => {
    it('changes only the fields that were sent', async () => {
      const { _id } = await commentService.createComment(ARTICLE, { name: 'יעל', text: 'שגיאת כתיב' });
      const updated = await commentService.updateComment(String(_id), { text: 'תוקן' });
      assert.strictEqual(updated.text, 'תוקן');
      assert.strictEqual(updated.authorName, 'יעל');
    });

    it('an empty name becomes "אורח"', async () => {
      const { _id } = await commentService.createComment(ARTICLE, { name: 'יעל', text: 'שלום' });
      const updated = await commentService.updateComment(String(_id), { name: '' });
      assert.strictEqual(updated.authorName, 'אורח');
    });

    it('applies the same rules as a new comment (400)', async () => {
      const { _id } = await commentService.createComment(ARTICLE, { text: 'שלום' });
      await rejectsWith(commentService.updateComment(String(_id), { text: '   ' }), 400);
      await rejectsWith(commentService.updateComment(String(_id), { name: 'x'.repeat(41) }), 400);
    });

    it('404 for a malformed or unknown id', async () => {
      await rejectsWith(commentService.updateComment('abc', { text: 'x' }), 404);
      await rejectsWith(commentService.updateComment(String(new mongoose.Types.ObjectId()), { text: 'x' }), 404);
    });
  });

  describe('deleteComment (editors)', () => {
    it('deletes the comment and returns its article id (for the log)', async () => {
      const { _id } = await commentService.createComment(ARTICLE, { text: 'שלום' });
      const deleted = await commentService.deleteComment(String(_id));
      assert.strictEqual(String(deleted.articleId), String(ARTICLE));
      assert.strictEqual(fake.store.length, 0);
    });

    it('404 for a malformed or unknown id, or one already deleted', async () => {
      const { _id } = await commentService.createComment(ARTICLE, { text: 'שלום' });
      await commentService.deleteComment(String(_id));
      await rejectsWith(commentService.deleteComment(String(_id)), 404);
      await rejectsWith(commentService.deleteComment('abc'), 404);
    });
  });

  describe('deleteByArticle', () => {
    it('deletes every comment of one article and leaves other articles alone', async () => {
      fake.seed(ARTICLE, 4);
      fake.seed(OTHER_ARTICLE, 2);
      assert.strictEqual(await commentService.deleteByArticle(ARTICLE), 4);
      assert.strictEqual(fake.store.length, 2);
    });
  });
});
