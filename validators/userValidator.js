const { ROLES } = require('../models/User');

const FIELDS = ['name', 'username', 'password', 'role'];
const OBJECT_ID = /^[a-f\d]{24}$/i;

function validateUser(input, { partial = false } = {}) {
  const value = {};
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { value, errors: { body: 'User data must be an object' } };
  }

  for (const field of Object.keys(input)) {
    if (!FIELDS.includes(field)) errors[field] = 'Field is not allowed';
  }

  for (const field of FIELDS) {
    if (partial && !Object.hasOwn(input, field)) continue;
    if (typeof input[field] !== 'string' || !input[field].trim()) {
      errors[field] = `${field} must be a non-empty string`;
      continue;
    }
    // Passwords are kept exactly as entered, including leading/trailing spaces.
    value[field] = field === 'password' ? input[field] : input[field].trim();
  }

  if (value.username) value.username = value.username.toLowerCase();
  if (value.role && !Object.values(ROLES).includes(value.role)) {
    errors.role = 'Role must be reporter or editor';
  }
  // bcrypt only uses the first 72 bytes; reject longer passwords instead of truncating.
  if (value.password && Buffer.byteLength(value.password, 'utf8') > 72) {
    errors.password = 'Password must be at most 72 bytes';
  }
  if (partial && !Object.keys(input).length) errors.body = 'Provide at least one field to update';

  return { value, errors };
}

function isValidUserId(id) {
  return typeof id === 'string' && OBJECT_ID.test(id);
}

function validateUsernameSearch(username) {
  if (username === undefined) return { value: '', errors: {} };
  if (typeof username !== 'string') {
    return { value: '', errors: { username: 'Username search must be a string' } };
  }
  return { value: username.trim().toLowerCase(), errors: {} };
}

module.exports = { validateUser, isValidUserId, validateUsernameSearch };
