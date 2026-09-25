const bcrypt = require('bcrypt');
const User = require('../models/User');
const { HttpError } = require('../utils/HttpError');
const { validateUser, isValidUserId, validateUsernameSearch } = require('../validators/userValidator');

const HASH_ROUNDS = 10;
// Includes older users whose documents do not yet have isDeleted.
const ACTIVE = { isDeleted: { $ne: true } };

function checkedValue(result) {
  if (Object.keys(result.errors).length) {
    throw new HttpError(400, 'Validation failed', result.errors);
  }
  return result.value;
}

function activeUserFilter(id) {
  if (!isValidUserId(id)) throw new HttpError(400, 'Invalid user id');
  return { _id: id, ...ACTIVE };
}

function requireUser(user) {
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}

function rethrowWriteError(error) {
  if (error.code === 11000) throw new HttpError(409, 'Username already exists');
  throw error;
}

async function passwordFields(value) {
  const { password, ...fields } = value;
  if (password !== undefined) fields.passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
  return fields;
}

async function listUsers({ username, limit = 50, skip = 0 } = {}) {
  const search = checkedValue(validateUsernameSearch(username));
  const filter = { ...ACTIVE };
  if (search) {
    // Search for literal text, not a client-provided regular expression.
    filter.username = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ username: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { items, total };
}

async function getUser(id) {
  return requireUser(await User.findOne(activeUserFilter(id)).lean());
}

async function createUser(input) {
  const fields = await passwordFields(checkedValue(validateUser(input)));
  try {
    return (await User.create(fields)).toObject();
  } catch (error) {
    rethrowWriteError(error);
  }
}

async function updateUser(id, input) {
  const filter = activeUserFilter(id);
  const fields = await passwordFields(checkedValue(validateUser(input, { partial: true })));
  try {
    const user = await User.findOneAndUpdate(filter, { $set: fields }, {
      returnDocument: 'after', runValidators: true,
    }).lean();
    return requireUser(user);
  } catch (error) {
    rethrowWriteError(error);
  }
}

async function deleteUser(id) {
  const user = await User.findOneAndUpdate(activeUserFilter(id), { $set: { isDeleted: true } }, {
    returnDocument: 'after', runValidators: true,
  }).lean();
  return requireUser(user);
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
