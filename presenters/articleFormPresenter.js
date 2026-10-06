const CATEGORIES = require('../config/categories');
const { STATUS, STATUS_LABELS } = require('../config/articleStatus');
const { formatRelative } = require('../utils/dates');
const { formatReturned, formatPublished, formatViews } = require('./reporterArticlePresenter');
const { LIMITS, tooLongMessage } = require('../validators/articleValidator');

// What the reporter should fix, in the words used in the form
const FIELD_PROBLEMS = {
  title: 'חובה למלא כותרת',
  category: 'יש לבחור קטגוריה מהרשימה',
  summary: 'התקציר ארוך מדי',
  body: 'חובה למלא את גוף הכתבה לפני שליחה לאישור עורך',
  image: 'הקובץ אינו תמונה תקינה (JPEG, PNG, GIF או WebP, עד 5MB)',
};

// A field over its length limit is a different problem from a missing one
const TOO_LONG_PROBLEMS = {
  title: `הכותרת עד ${LIMITS.title} תווים`,
  summary: 'התקציר ארוך מדי',
  body: 'גוף הכתבה ארוך מדי',
};

// details: { field: 'English message' } from the validator
function toProblemMessages(details = {}) {
  return Object.entries(details).map(([field, message]) => {
    if (TOO_LONG_PROBLEMS[field] && message === tooLongMessage(LIMITS[field])) return TOO_LONG_PROBLEMS[field];
    return FIELD_PROBLEMS[field] || `${field}: ${message}`;
  });
}

// Starting values for "+ כתבה חדשה"
function newArticle() {
  return {
    title: '',
    summary: '',
    body: '',
    category: CATEGORIES[0],
    image: null,
    status: STATUS.DRAFT,
    returnedCount: 0,
    editorNotes: [],
    liveVersion: null,
  };
}

function toNoteRows(editorNotes = []) {
  return [...editorNotes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(note => ({
      time: formatRelative(note.createdAt),
      by: `עורך: ${note.by?.name ?? 'לא ידוע'}`,
      text: note.text,
    }));
}

// Turns an article into the shape views/article-form.ejs expects.
// input (optional) is what the reporter just typed, shown again when saving failed.
function toArticleForm(article, authorName, input = {}) {
  const pick = field => (typeof input[field] === 'string' ? input[field] : article[field]);
  const live = article.liveVersion;

  return {
    id: article._id ? String(article._id) : undefined,
    title: pick('title'),
    summary: pick('summary'),
    body: pick('body'),
    category: pick('category'),
    image: article.image ?? null,
    author: authorName,
    status: STATUS_LABELS[article.status],
    updated: formatRelative(article.updatedAt),
    published: formatPublished(article),
    returned: formatReturned(article.returnedCount),
    views: formatViews(article),
    notes: toNoteRows(article.editorNotes),
    // The version the public sees, so the form can tell when there is nothing new to send
    live: live
      ? { title: live.title, summary: live.summary, body: live.body, category: live.category, image: live.image ?? null }
      : null,
  };
}

module.exports = { newArticle, toArticleForm, toProblemMessages };
