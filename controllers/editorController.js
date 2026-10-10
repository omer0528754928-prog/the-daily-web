const editorService = require('../services/editorService');
const { toEditorRow, toReviewView } = require('../presenters/editorArticlePresenter');
const { toProblemMessages } = require('../presenters/articleFormPresenter');
const { STATUS, STATUS_LABELS } = require('../config/articleStatus');
const CATEGORIES = require('../config/categories');
const { recordLog } = require('../services/loggingService');

// Filter tabs shown above the queue (English status in the URL, Hebrew label on screen)
const TABS = [
  { key: '', label: 'הכל' },
  { key: STATUS.PENDING, label: STATUS_LABELS[STATUS.PENDING] },
  { key: STATUS.DRAFT, label: STATUS_LABELS[STATUS.DRAFT] },
  { key: STATUS.RETURNED, label: STATUS_LABELS[STATUS.RETURNED] },
  { key: STATUS.PUBLISHED, label: STATUS_LABELS[STATUS.PUBLISHED] },
];

// Builds "/editor?..." keeping the active status tab and changing only the page
function editorPageUrl(status, page) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (page > 1) params.set('page', page);
  const query = params.toString();
  return query ? `/editor?${query}` : '/editor';
}

// The numbered page buttons: first three and last three pages, the current page,
// and a gap (…) wherever numbers were skipped (same shape as the reporter table)
function editorPageItems(status, current, pages) {
  const wanted = pages <= 7
    ? Array.from({ length: pages }, (_, index) => index + 1)
    : [1, 2, 3, pages - 2, pages - 1, pages, current];
  const shown = new Set(wanted.filter(number => number >= 1 && number <= pages));

  const items = [];
  let previous = 0;
  for (const number of [...shown].sort((a, b) => a - b)) {
    if (previous && number - previous > 1) items.push({ type: 'gap' });
    items.push({ type: 'page', number, url: editorPageUrl(status, number), current: number === current });
    previous = number;
  }
  return items;
}

// The editor queue's pager, built exactly like the reporter's (see reporterFiltersPresenter.toPager)
function buildEditorPager({ page, pageSize, total, status }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);

  return {
    page: current,
    pages,
    total,
    shown: Math.max(0, Math.min(current * pageSize, total) - (current - 1) * pageSize),
    items: editorPageItems(status, current, pages),
    prevUrl: current > 1 ? editorPageUrl(status, current - 1) : null,
    nextUrl: current < pages ? editorPageUrl(status, current + 1) : null,
  };
}

// A one-time message shown on the next page (same pattern as the reporter area)
function remember(req, message) {
  req.session.flash = message;
}
function takeFlash(req) {
  const message = req.session.flash;
  delete req.session.flash;
  return message;
}

// Records a significant editor action to the operational log (fire-and-forget,
// like the global error handler). Only controlled, secret-free values are passed.
function logEditorAction(req, event, message) {
  const userId = req.session?.user?.id;
  void recordLog({
    level: 'info',
    source: 'editor',
    event,
    message,
    userId: typeof userId === 'string' && /^[a-f\d]{24}$/i.test(userId) ? userId : undefined,
    method: req.method,
    path: typeof req.route?.path === 'string' ? req.route.path : undefined,
    statusCode: 200,
  });
}

// GET /editor: every reporter's articles, filtered by the status tab, one page at a time
async function showQueue(req, res) {
  const { page, limit, skip } = req.pagination;
  const { items, total } = await editorService.listAll({ filters: req.filters, limit, skip });
  const activeStatus = req.filters.status?.[0] || '';

  res.render('editor', {
    flash: takeFlash(req),
    currentUser: req.session.user,
    query: req.query,
    queue: items.map(toEditorRow),
    tabs: TABS,
    activeStatus,
    pager: buildEditorPager({ page, pageSize: limit, total, status: activeStatus }),
  });
}

// GET /editor/articles/:id/review
function showReview(req, res) {
  res.render('review', {
    flash: takeFlash(req),
    currentUser: req.session.user,
    query: req.query,
    article: toReviewView(req.article),
    categories: CATEGORIES,
    result: req.query.result,
  });
}

// Re-open the review screen with the typed text and a list of what to fix
function showReviewProblems(req, res, status, problems, input) {
  res.status(status).render('review', {
    currentUser: req.session.user,
    query: req.query,
    article: toReviewView(req.article, input),
    categories: CATEGORIES,
    problems,
  });
}

// POST /editor/articles/:id/edit: the editor fixes the submitted content himself
async function editContent(req, res) {
  try {
    await editorService.editContent(req.params.id, req.body ?? {}, req.file);
    logEditorAction(req, 'article_edited_by_editor', `Editor edited pending article ${req.params.id}`);
    remember(req, 'התוכן עודכן.');
    res.redirect(`/editor/articles/${req.params.id}/review`);
  } catch (error) {
    if (!error.details) throw error;
    showReviewProblems(req, res, error.status, toProblemMessages(error.details), req.body ?? {});
  }
}

// POST /editor/articles/:id/approve: pending -> published
async function approve(req, res) {
  await editorService.approve(req.params.id);
  logEditorAction(req, 'article_approved', `Editor approved and published article ${req.params.id}`);
  remember(req, 'הכתבה אושרה ופורסמה — הגרסה החדשה מוצגת כעת לציבור.');
  res.redirect('/editor');
}

// POST /editor/articles/:id/return: pending -> returned, with a required note
async function returnToReporter(req, res) {
  try {
    await editorService.returnToReporter(req.params.id, req.session.user.id, req.body?.note);
    logEditorAction(req, 'article_returned', `Editor returned article ${req.params.id} for fixes`);
    remember(req, 'הכתבה הוחזרה לכתב/ת עם הערה.');
    res.redirect('/editor');
  } catch (error) {
    if (!error.details) throw error;
    showReviewProblems(req, res, error.status, ['חובה לכתוב הערה לכתב/ת לפני החזרה לתיקונים'], req.body ?? {});
  }
}

// POST /editor/articles/:id/delete
async function remove(req, res) {
  await editorService.remove(req.params.id);
  logEditorAction(req, 'article_deleted', `Editor deleted article ${req.params.id}`);
  remember(req, 'הכתבה נמחקה.');
  res.redirect('/editor');
}

module.exports = { showQueue, showReview, editContent, approve, returnToReporter, remove };
