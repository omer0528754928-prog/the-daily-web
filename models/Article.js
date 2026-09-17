const mongoose = require('mongoose');
const CATEGORIES = require('../config/categories');
const { STATUS } = require('../config/articleStatus');

const editorNoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '', trim: true },
    body: { type: String, default: '' },
    category: { type: String, enum: CATEGORIES, required: true },
    tags: { type: [String], default: [] },

    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.DRAFT },
    editorNotes: { type: [editorNoteSchema], default: [] },
    returnedCount: { type: Number, default: 0, min: 0 },
    views: { type: Number, default: 0, min: 0 },
    publishedAt: { type: Date },
    republishAt: { type: Date },

    // Links between stories, kept from the original dataset
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    relation: { type: String, enum: ['continuation', 'ripple', null], default: null },

    // The id from articlesDB/articles.json, so the seed script can run more than once
    legacyId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

articleSchema.index({ author: 1, updatedAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
