const mongoose = require('mongoose');
const CATEGORIES = require('../config/categories');
const { STATUS } = require('../config/articleStatus');
// Registers the User model, which editorNotes.by and author refer to (needed by populate)
require('./User');

const editorNoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

// The version the public sees. Only editor approval replaces it.
const liveVersionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    body: { type: String, default: '' },
    category: { type: String, enum: CATEGORIES, required: true },
    image: { type: String, default: null },
    version: { type: Number, required: true, min: 1 },
    publishedAt: { type: Date, required: true },
  },
  { _id: false },
);

const articleSchema = new mongoose.Schema(
  {
    // Working copy: the text the reporter edits
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '', trim: true },
    body: { type: String, default: '' },
    category: { type: String, enum: CATEGORIES, required: true },
    image: { type: String, default: null },
    tags: { type: [String], default: [] },
    version: { type: Number, default: 1, min: 1 },

    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.DRAFT },
    submittedAt: { type: Date },
    republishAt: { type: Date },
    editorNotes: { type: [editorNoteSchema], default: [] },
    returnedCount: { type: Number, default: 0, min: 0 },
    views: { type: Number, default: 0, min: 0 },

    // null until the editor approves the article for the first time
    liveVersion: { type: liveVersionSchema, default: null },

    // Links between stories, kept from the original dataset
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    relation: { type: String, enum: ['continuation', 'ripple', null], default: null },

    // The id from articlesDB/articles.json, so the seed script can run more than once
    legacyId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

// Covers the reporter table: own articles, newest first, with or without a status filter
articleSchema.index({ author: 1, status: 1, updatedAt: -1 });
articleSchema.index({ author: 1, updatedAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
