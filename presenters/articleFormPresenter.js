const CATEGORIES = require('../config/categories');
const { STATUS, STATUS_LABELS } = require('../config/articleStatus');
const { formatRelative } = require('../utils/dates');
const { formatReturned, formatPublished, formatViews } = require('./reporterArticlePresenter');

// What the reporter should fix, in the words used in the form
const FIELD_PROBLEMS = {
  title: 'חובה למלא כותרת',
  category: 'יש לבחור קטגוריה מהרשימה',
  summary: 'התקציר ארוך מדי',
  body: 'חובה למלא את גוף הכתבה לפני שליחה לאישור עורך',
  image: 'הקובץ אינו תמונה תקינה (JPEG, PNG, GIF או WebP, עד 5MB)',
  republishAt: 'תאריך הפרסום מחדש חייב להיות תקין ובעתיד',
};

// details: { field: 'English message' } from the validator
function toProblemMessages(details = {}) {
  return Object.entries(details).map(([field, message]) => FIELD_PROBLEMS[field] || `${field}: ${message}`);
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
  };
}

module.exports = { newArticle, toArticleForm, toProblemMessages };
