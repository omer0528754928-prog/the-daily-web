const LIMITS = Object.freeze({ authorName: 40, text: 1000 });

// Anything that is not a string (e.g. an array from "text[]=a") counts as empty
function toText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// The form sends "name" and "text". The name is optional: an empty one is saved as a guest.
function validateComment(input = {}) {
  const value = { authorName: toText(input.name), text: toText(input.text) };
  const errors = {};

  if (!value.text) errors.text = 'Comment text is required';
  for (const [field, max] of Object.entries(LIMITS)) {
    if (value[field].length > max) errors[field] = `Must be at most ${max} characters`;
  }

  return { value, errors };
}

module.exports = { LIMITS, validateComment };
