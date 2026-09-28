const mongoose = require('mongoose');

const EVENT_TYPES = ['article_view', 'comment_created', 'filter_used', 'sort_used', 'login'];

const usageEventSchema = new mongoose.Schema({
  type: { type: String, enum: EVENT_TYPES, required: true },
  source: { type: String, required: true, maxlength: 100 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
  value: { type: String, maxlength: 200 },
  createdAt: { type: Date, default: Date.now },
}, { bufferCommands: false, versionKey: false });

module.exports = mongoose.model('UsageEvent', usageEventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
