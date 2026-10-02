const bcrypt = require('bcrypt');
const User = require('../models/User');
const { HttpError } = require('../utils/HttpError');
const { validateLogin } = require('../validators/authValidator');

const INVALID_CREDENTIALS = 'Invalid username or password';
const OBJECT_ID = /^[a-f\d]{24}$/i;

function toSessionUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

async function authenticate(input) {
  const { value, errors } = validateLogin(input);
  if (Object.keys(errors).length) throw new HttpError(400, INVALID_CREDENTIALS);

  const user = await User.findOne({ username: value.username, isDeleted: { $ne: true } })
    .select('+passwordHash')
    .lean();
  if (!user || !user.passwordHash) throw new HttpError(401, INVALID_CREDENTIALS);

  let matches = false;
  try {
    matches = await bcrypt.compare(value.password, user.passwordHash);
  } catch {
    // Invalid stored hashes must not expose bcrypt details to the client.
    throw new HttpError(401, INVALID_CREDENTIALS);
  }
  if (!matches || !Object.values(User.ROLES).includes(user.role)) {
    throw new HttpError(401, INVALID_CREDENTIALS);
  }
  return toSessionUser(user);
}

async function findSessionUser(id) {
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) return null;
  const user = await User.findOne({ _id: id, isDeleted: { $ne: true } })
    .select('name username role')
    .lean();
  return user ? toSessionUser(user) : null;
}

module.exports = { authenticate, findSessionUser };
