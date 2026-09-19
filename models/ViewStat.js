'use strict';

/**
 * ViewStat model (Phase 2) — Member 5 (owner).
 * ---------------------------------------------------------------------------
 * Records how many times each article was viewed, over time.
 *
 * SCALABILITY DECISION (this is the graded design choice):
 *   The site may serve thousands of concurrent readers, so we do NOT write one
 *   document per single view. Instead we AGGREGATE AT WRITE TIME into one
 *   document per (articleId, day) — a "bucket" — and bump it with an atomic
 *   $inc + upsert. That single operation is cheap and lock-free, the collection
 *   stays small, and the Analytics graphs are built by reading a handful of
 *   bucket docs instead of millions of rows.
 *
 * CONTRACT for Member 3 (who counts a view on every article page hit):
 *       await ViewStat.recordView(articleId);        // +1 for today's bucket
 * CONTRACT for the Editor approve action (Member 5, bridges Domain 1 → 3):
 *       await ViewStat.markPublishPoint(articleId);  // marks an update point
 * ---------------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// normalise any date to midnight UTC (the day-bucket key)
function dayBucket(when) {
  const d = when ? new Date(when) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const viewStatSchema = new Schema(
  {
    articleId: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
    day: { type: Date, required: true },            // start of the day bucket (UTC)
    count: { type: Number, default: 0, min: 0 },    // views accumulated in this bucket
    isUpdatePublishPoint: { type: Boolean, default: false }, // an update was published on this day
  },
  { timestamps: true }
);

// one bucket per article per day (also the main read index for the graphs)
viewStatSchema.index({ articleId: 1, day: 1 }, { unique: true });
viewStatSchema.index({ day: 1 });

// +1 view for the article's bucket of the given moment (atomic, upsert).
viewStatSchema.statics.recordView = function (articleId, when) {
  return this.updateOne(
    { articleId, day: dayBucket(when) },
    { $inc: { count: 1 } },
    { upsert: true }
  );
};

// mark the day-bucket as an update-publish point (used by the editor on approve).
viewStatSchema.statics.markPublishPoint = function (articleId, when) {
  return this.updateOne(
    { articleId, day: dayBucket(when) },
    { $set: { isUpdatePublishPoint: true } },
    { upsert: true }
  );
};

viewStatSchema.statics.dayBucket = dayBucket;

module.exports = mongoose.model('ViewStat', viewStatSchema);
