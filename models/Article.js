'use strict';

/**
 * Article model  —  "The Daily Web"
 * ---------------------------------------------------------------------------
 * ⚠️  PROVISIONAL / SHARED MODEL.
 *     Ownership of the Article schema + its state machine belongs to Member 4.
 *     This version was authored by Member 5 so that (a) the 500 synthetic
 *     articles can be seeded, and (b) the Editor area (Phase 6) and Impact
 *     Analytics (Phase 7) have a concrete schema to build against.
 *
 *     Reconcile the final schema with Member 4 before integration — especially
 *     the draft/pending-vs-published *versioning* strategy (the `pending`
 *     sub-document below) and the legal state transitions.
 * ---------------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

// The four article states defined by the spec.
const ARTICLE_STATUS = ['draft', 'pending', 'published', 'returned'];

/**
 * A "pending update" holds the NEW content a reporter proposed for an article
 * that is ALREADY published. While it waits, the published fields above stay
 * public (readers keep seeing the approved version). Only editor approval
 * copies this content up into the live fields. _id:false = it's just a nested
 * bag of fields, not its own document.
 */
const pendingSchema = new Schema(
  {
    title: { type: String, trim: true },
    summary: { type: String, trim: true },
    content: { type: String },
    image: { type: String },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const articleSchema = new Schema(
  {
    // --- core editorial content (the currently-published version) ---------
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '', trim: true }, // short teaser for the feed
    content: { type: String, required: true },          // full article body
    image: { type: String, default: '' },               // main image URL (optional)
    category: { type: String, required: true, trim: true, index: true },
    tags: { type: [String], default: [] },

    // --- workflow / state machine ----------------------------------------
    status: {
      type: String,
      enum: ARTICLE_STATUS,
      default: 'published',
      index: true,
    },
    editorNote: { type: String, default: '' }, // note attached when returned to reporter

    // --- versioning: pending update on an already-published article -------
    hasPendingUpdate: { type: Boolean, default: false },
    pending: { type: pendingSchema, default: null },

    // --- authorship -------------------------------------------------------
    // reporterId ties to the User model (Member 1/4). Optional for now because
    // the synthetic seed data has no real users behind it.
    reporterId: { type: Schema.Types.ObjectId, ref: 'User' },
    author: { type: String, default: 'מערכת The Daily Web', trim: true },

    // --- popularity / feed ordering --------------------------------------
    // Denormalised popularity counter that feeds the public feed sort.
    // The authoritative per-view records live in the ViewStat model (Member 5);
    // coordinate with Member 2 on who increments this counter.
    views: { type: Number, default: 0, min: 0 },
    publishedAt: { type: Date },

    // --- update / relation chain -----------------------------------------
    // Preserved from the source data. A "continuation" is a follow-up/update
    // to a parent article — the natural anchor for an update-publish point in
    // the Impact Analytics graph (Phase 7).
    parentId: { type: Schema.Types.ObjectId, ref: 'Article', default: null },
    relation: { type: String, enum: ['continuation', 'ripple', null], default: null },
    isContinuation: { type: Boolean, default: false },

    // --- seeding / traceability ------------------------------------------
    // Original id from articlesDB/articles.json. Lets the seed run be
    // idempotent (upsert by legacyId) and keeps a link back to the source.
    legacyId: { type: Number, index: true },
  },
  { timestamps: true } // adds createdAt / updatedAt
);

// Text index on title to satisfy the "search on a main field" requirement.
articleSchema.index({ title: 'text' });
// Feed query: published articles newest-first.
articleSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
module.exports.ARTICLE_STATUS = ARTICLE_STATUS;
