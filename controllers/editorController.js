'use strict';

/**
 * Editor controller (Phase 6) — Member 5.
 * ---------------------------------------------------------------------------
 * The "brain" behind the editor screen. Every handler:
 *   • assumes the request already passed the server-side auth guards
 *     (see routes/editor.js + middleware/auth.js),
 *   • validates its input,
 *   • enforces the legal state transitions,
 *   • is wrapped in try/catch so a bad input or illegal action returns a clean
 *     error and never crashes the server.
 * ---------------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const Article = require('../models/Article');
const ViewStat = require('../models/ViewStat');
const { logEditorAction } = require('../utils/logger');

const STATUSES = ['draft', 'pending', 'published', 'returned'];

// ---- state machine: which editor actions are legal on a given article ------
// Legal editor moves per the spec:
//   • a brand-new "pending" article  → approve (publish) OR return (+note)
//   • a published article that has a pending update → approve (promote it) OR
//     return (discard the update, keep the live version public)
function canApprove(a) {
  return a.status === 'pending' || (a.status === 'published' && a.hasPendingUpdate);
}
function canReturn(a) {
  return a.status === 'pending' || (a.status === 'published' && a.hasPendingUpdate);
}
function canEdit(a) {
  return a.status === 'pending' || (a.status === 'published' && a.hasPendingUpdate);
}

function badId(res) {
  return res.status(400).json({ error: 'מזהה כתבה לא תקין' });
}

// ---- page ------------------------------------------------------------------
function renderEditorPage(req, res) {
  res.render('editor/index', { user: req.session.user, statuses: STATUSES });
}

// ---- API: list all articles (optional ?status= filter) + counts ------------
async function apiList(req, res) {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && STATUSES.includes(status)) filter.status = status;

    const articles = await Article.find(filter)
      .select('title category status author publishedAt updatedAt hasPendingUpdate editorNote')
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    // counts per status for the filter tabs
    const agg = await Article.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    const counts = { all: 0 };
    for (const s of STATUSES) counts[s] = 0;
    for (const c of agg) {
      counts[c._id] = c.n;
      counts.all += c.n;
    }

    res.json({ articles, counts });
  } catch (err) {
    console.error('apiList error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת הכתבות' });
  }
}

// ---- API: one article, full (incl. the pending version) --------------------
async function apiGetOne(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const article = await Article.findById(req.params.id).lean();
    if (!article) return res.status(404).json({ error: 'הכתבה לא נמצאה' });
    res.json({ article });
  } catch (err) {
    console.error('apiGetOne error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת הכתבה' });
  }
}

// ---- API: editor self-edit of the (pending) content ------------------------
async function apiUpdate(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'הכתבה לא נמצאה' });
    if (!canEdit(article)) {
      return res.status(409).json({ error: `לא ניתן לערוך כתבה במצב "${article.status}"` });
    }

    const { title, summary, content, image } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ error: 'כותרת ותוכן הם שדות חובה' });
    }

    if (article.status === 'published' && article.hasPendingUpdate) {
      // edit the PENDING version, never the live published one
      article.pending = { title, summary: summary || '', content, image: image || '', submittedAt: new Date() };
    } else {
      article.title = title;
      article.summary = summary || '';
      article.content = content;
      if (image !== undefined) article.image = image;
    }
    await article.save();
    logEditorAction('edit', { articleId: String(article._id), by: req.session.user.name });
    res.json({ ok: true, article: article.toObject() });
  } catch (err) {
    console.error('apiUpdate error:', err);
    res.status(500).json({ error: 'שגיאה בשמירת השינויים' });
  }
}

// ---- API: approve & publish ------------------------------------------------
async function apiApprove(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'הכתבה לא נמצאה' });
    if (!canApprove(article)) {
      return res.status(409).json({ error: `לא ניתן לאשר כתבה במצב "${article.status}"` });
    }

    const isUpdatePublish = article.status === 'published' && article.hasPendingUpdate;
    if (isUpdatePublish) {
      // promote the pending content to become the reader-facing version
      const p = article.pending || {};
      if (p.title != null) article.title = p.title;
      if (p.summary != null) article.summary = p.summary;
      if (p.content != null) article.content = p.content;
      if (p.image != null) article.image = p.image;
      article.pending = null;
      article.hasPendingUpdate = false;
      // keep the original publishedAt for a re-publish
    } else {
      article.status = 'published';
      if (!article.publishedAt) article.publishedAt = new Date();
    }
    article.editorNote = '';
    await article.save();

    // 🔗 BRIDGE TO DOMAIN 3: record a ViewStat publish-point so the Impact
    // Analytics graph can mark this moment. Never let it break the approval.
    try {
      await ViewStat.markPublishPoint(article._id, new Date());
    } catch (e) {
      console.error('markPublishPoint failed:', e.message);
    }

    logEditorAction('approve', {
      articleId: String(article._id),
      kind: isUpdatePublish ? 'update-publish' : 'first-publish',
      by: req.session.user.name,
    });
    res.json({ ok: true, article: article.toObject() });
  } catch (err) {
    console.error('apiApprove error:', err);
    res.status(500).json({ error: 'שגיאה באישור הכתבה' });
  }
}

// ---- API: return to reporter with a note -----------------------------------
async function apiReturn(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const note = (req.body && req.body.note ? String(req.body.note) : '').trim();
    if (!note) return res.status(400).json({ error: 'חובה לצרף הערה בעת החזרה לתיקונים' });

    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'הכתבה לא נמצאה' });
    if (!canReturn(article)) {
      return res.status(409).json({ error: `לא ניתן להחזיר כתבה במצב "${article.status}"` });
    }

    const isUpdateReturn = article.status === 'published' && article.hasPendingUpdate;
    article.editorNote = note;
    if (isUpdateReturn) {
      // discard the pending edit; the live published version stays public
      article.pending = null;
      article.hasPendingUpdate = false;
    } else {
      article.status = 'returned';
    }
    await article.save();
    logEditorAction('return', { articleId: String(article._id), by: req.session.user.name, note });
    res.json({ ok: true, article: article.toObject() });
  } catch (err) {
    console.error('apiReturn error:', err);
    res.status(500).json({ error: 'שגיאה בהחזרת הכתבה' });
  }
}

// ---- API: delete an article ------------------------------------------------
async function apiDelete(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const article = await Article.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ error: 'הכתבה לא נמצאה' });
    logEditorAction('delete', {
      articleId: String(article._id),
      title: article.title,
      by: req.session.user.name,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('apiDelete error:', err);
    res.status(500).json({ error: 'שגיאה במחיקת הכתבה' });
  }
}

module.exports = {
  STATUSES,
  renderEditorPage,
  apiList,
  apiGetOne,
  apiUpdate,
  apiApprove,
  apiReturn,
  apiDelete,
  // exported for unit testing the state machine
  _sm: { canApprove, canReturn, canEdit },
};
