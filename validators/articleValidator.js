const CATEGORIES = require('../config/categories');

const LIMITS = Object.freeze({ title: 200, summary: 500, body: 50000 });
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Recognizes an image by its first bytes, so a renamed non-image file is rejected
const IMAGE_SIGNATURES = [
  { ext: '.jpg', matches: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.png', matches: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: '.gif', matches: b => b.subarray(0, 4).toString('ascii') === 'GIF8' },
  { ext: '.webp', matches: b => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];

function tooLongMessage(max) {
  return `Must be at most ${max} characters`;
}

function toText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickContent(input) {
  return {
    title: toText(input.title),
    summary: toText(input.summary),
    body: toText(input.body),
    category: toText(input.category),
  };
}

function checkContent(content, { requireAll }) {
  const errors = {};

  if (!content.title) errors.title = 'Title is required';
  if (!CATEGORIES.includes(content.category)) errors.category = 'Category is not valid';
  // The summary is optional: many published articles never had one
  if (requireAll && !content.body) errors.body = 'Body is required before sending to the editor';

  for (const [field, max] of Object.entries(LIMITS)) {
    if (content[field].length > max) errors[field] = tooLongMessage(max);
  }

  return errors;
}

// Save as draft: only the basics must be valid
function validateDraft(input) {
  const value = pickContent(input);
  return { value, errors: checkContent(value, { requireAll: false }) };
}

// Send to the editor: everything must be filled in
function validateForSubmit(input) {
  const value = pickContent(input);
  return { value, errors: checkContent(value, { requireAll: true }) };
}

// file: { buffer, size } from the form, or undefined when no image was chosen
function validateImage(file) {
  if (!file) return { value: undefined };
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Image must be at most 5MB' };

  const signature = IMAGE_SIGNATURES.find(s => s.matches(file.buffer));
  if (!signature) return { error: 'Image must be JPEG, PNG, GIF or WebP' };
  return { value: { buffer: file.buffer, ext: signature.ext } };
}

module.exports = { LIMITS, tooLongMessage, validateDraft, validateForSubmit, validateImage };
