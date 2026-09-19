'use strict';

/**
 * Impact Analytics controller (Phase 7) — Member 5.
 * ---------------------------------------------------------------------------
 * Serves the analytics dashboard page and its REST/JSON endpoints. Every data
 * endpoint here is editor-only (guarded in routes/analytics.js). All values are
 * computed with MongoDB aggregations on the server; the browser only draws them.
 * ---------------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const Article = require('../models/Article');
const ViewStat = require('../models/ViewStat');
const presence = require('../utils/presence');

// ---- parse the shared filters (category + date range) ----------------------
function parseFilters(q = {}) {
  const category = (q.category || '').trim() || null;
  let from = q.from ? new Date(q.from) : null;
  let to = q.to ? new Date(q.to) : null;
  if (from && isNaN(from)) from = null;
  if (to && isNaN(to)) to = null;
  if (to) to.setUTCHours(23, 59, 59, 999); // make the end date inclusive
  return { category, from, to };
}

// ---- page ------------------------------------------------------------------
function renderPage(req, res) {
  res.render('editor/analytics', { user: req.session.user });
}

// ---- live users heartbeat (PUBLIC) -----------------------------------------
function ping(req, res) {
  presence.touch(req.sessionID || req.ip);
  res.json({ live: presence.count() });
}

// ---- main dashboard data (editor-only) -------------------------------------
async function overview(req, res) {
  try {
    const { category, from, to } = parseFilters(req.query);

    // --- article-based filters (by createdAt) ---
    const artMatch = {};
    if (category) artMatch.category = category;
    const created = {};
    if (from) created.$gte = from;
    if (to) created.$lte = to;
    if (Object.keys(created).length) artMatch.createdAt = created;

    // 1) total articles
    const totalArticles = await Article.countDocuments(artMatch);

    // 8) count by status (for the flow diagram)
    const byStatus = { draft: 0, pending: 0, published: 0, returned: 0 };
    (await Article.aggregate([{ $match: artMatch }, { $group: { _id: '$status', n: { $sum: 1 } } }]))
      .forEach((x) => { if (x._id in byStatus) byStatus[x._id] = x.n; });

    // 7) articles by category (pie)
    const byCategory = (await Article.aggregate([
      { $match: artMatch },
      { $group: { _id: '$category', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ])).map((x) => ({ category: x._id, count: x.n }));

    // 6) monthly publishing trend (published only, by publishedAt)
    const pubMatch = { status: 'published', publishedAt: { $ne: null } };
    if (category) pubMatch.category = category;
    if (from || to) {
      pubMatch.publishedAt = {};
      if (from) pubMatch.publishedAt.$gte = from;
      if (to) pubMatch.publishedAt.$lte = to;
    }
    const byMonth = (await Article.aggregate([
      { $match: pubMatch },
      { $group: { _id: { y: { $year: '$publishedAt' }, m: { $month: '$publishedAt' } }, n: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ])).map((x) => ({ ym: `${x._id.y}-${String(x._id.m).padStart(2, '0')}`, count: x.n }));

    // --- view-based filters (ViewStat by day bucket, category via article ids) ---
    const vsMatch = {};
    const day = {};
    if (from) day.$gte = ViewStat.dayBucket(from);
    if (to) day.$lte = to;
    if (Object.keys(day).length) vsMatch.day = day;
    if (category) {
      const ids = await Article.find({ category }).distinct('_id');
      vsMatch.articleId = { $in: ids };
    }

    // 2) total views
    const totalViews =
      (await ViewStat.aggregate([{ $match: vsMatch }, { $group: { _id: null, t: { $sum: '$count' } } }]))[0]?.t || 0;

    // 9) views per article (table, top 100)
    const perArticle = await ViewStat.aggregate([
      { $match: vsMatch },
      { $group: { _id: '$articleId', views: { $sum: '$count' } } },
      { $sort: { views: -1 } },
      { $limit: 100 },
      { $lookup: { from: 'articles', localField: '_id', foreignField: '_id', as: 'a' } },
      { $unwind: '$a' },
      { $project: { _id: 0, articleId: '$_id', legacyId: '$a.legacyId', title: '$a.title', category: '$a.category', views: 1 } },
    ]);

    // categories for the filter dropdown (always the full list)
    const allCategories = (await Article.distinct('category')).sort();

    res.json({ totalArticles, totalViews, byStatus, byCategory, byMonth, perArticle, allCategories });
  } catch (err) {
    console.error('overview error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת נתוני האנליטיקות' });
  }
}

// ---- list of articles for the per-article chart picker (editor-only) -------
async function articleList(req, res) {
  try {
    const rows = await ViewStat.aggregate([
      { $group: { _id: '$articleId', views: { $sum: '$count' } } },
      { $sort: { views: -1 } },
      { $limit: 200 },
      { $lookup: { from: 'articles', localField: '_id', foreignField: '_id', as: 'a' } },
      { $unwind: '$a' },
      { $project: { _id: 0, articleId: '$_id', legacyId: '$a.legacyId', title: '$a.title', views: 1 } },
    ]);
    res.json({ articles: rows });
  } catch (err) {
    console.error('articleList error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת רשימת הכתבות' });
  }
}

// ---- per-article views-over-time + publish points (Phase 7, editor-only) ---
async function articleSeries(req, res) {
  try {
    const { articleId } = req.query;
    if (!mongoose.isValidObjectId(articleId)) return res.status(400).json({ error: 'מזהה כתבה לא תקין' });
    const article = await Article.findById(articleId).select('title legacyId').lean();
    if (!article) return res.status(404).json({ error: 'הכתבה לא נמצאה' });
    const rows = await ViewStat.find({ articleId }).sort({ day: 1 }).lean();
    res.json({
      article,
      series: rows.map((r) => ({ day: r.day, count: r.count, isUpdatePublishPoint: !!r.isUpdatePublishPoint })),
    });
  } catch (err) {
    console.error('articleSeries error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת נתוני הכתבה' });
  }
}

module.exports = {
  renderPage,
  ping,
  overview,
  articleList,
  articleSeries,
  parseFilters, // exported for tests
};
