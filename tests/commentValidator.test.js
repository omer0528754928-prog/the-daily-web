// Checks the rules for a guest comment (validators/commentValidator.js): what is accepted,
// what is rejected, and that strange input (arrays, numbers, nothing) never crashes it.
// Run with: npm test

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { LIMITS, validateComment } = require('../validators/commentValidator');

describe('validateComment', () => {
  it('accepts a name and a text, trimmed', () => {
    const { value, errors } = validateComment({ name: '  יעל  ', text: '  כתבה מעולה  ' });
    assert.deepStrictEqual(errors, {});
    assert.deepStrictEqual(value, { authorName: 'יעל', text: 'כתבה מעולה' });
  });

  it('accepts an empty name (the guest name is filled in later)', () => {
    const { value, errors } = validateComment({ name: '', text: 'היי' });
    assert.deepStrictEqual(errors, {});
    assert.strictEqual(value.authorName, '');
  });

  it('rejects a missing or blank text', () => {
    assert.ok(validateComment({ name: 'x' }).errors.text);
    assert.ok(validateComment({ text: '   \n  ' }).errors.text);
    assert.ok(validateComment().errors.text);
  });

  it('enforces the length limits exactly', () => {
    assert.deepStrictEqual(validateComment({ name: 'a'.repeat(LIMITS.authorName), text: 'b'.repeat(LIMITS.text) }).errors, {});
    assert.ok(validateComment({ text: 'b'.repeat(LIMITS.text + 1) }).errors.text);
    assert.ok(validateComment({ name: 'a'.repeat(LIMITS.authorName + 1), text: 'ok' }).errors.authorName);
  });

  it('treats anything that is not a string as empty, without crashing', () => {
    // e.g. "text[]=a&text[]=b" in a form arrives as an array
    for (const text of [['a', 'b'], { $gt: '' }, 42, null, true]) {
      const { errors } = validateComment({ name: ['x'], text });
      assert.ok(errors.text, `text = ${JSON.stringify(text)}`);
    }
  });
});
