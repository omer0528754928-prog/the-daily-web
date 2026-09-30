const mongoose = require('mongoose');

const operationalLogSchema = new mongoose.Schema({
  level: { type: String, enum: ['info', 'warn', 'error'], required: true },
  source: { type: String, required: true },
  event: { type: String, required: true },
  message: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  method: String,
  path: String,
  statusCode: Number,
  createdAt: { type: Date, default: Date.now },
}, { bufferCommands: false, versionKey: false });

module.exports = mongoose.model('OperationalLog', operationalLogSchema);
