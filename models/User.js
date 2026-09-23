const mongoose = require('mongoose');

const ROLES = Object.freeze({
  REPORTER: 'reporter',
  EDITOR: 'editor',
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: {
      type: String,
      select: false,
    },
    role: { type: String, enum: Object.values(ROLES), required: true },
  },
  { timestamps: true },
);

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
