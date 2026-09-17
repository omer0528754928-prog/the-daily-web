const { STATUS, STATUS_LABELS } = require('../config/articleStatus');
const { formatDateTime, formatRelative } = require('../utils/dates');

const EMPTY = '—';

function formatReturned(count) {
  if (!count) return 'לא';
  if (count === 1) return 'כן · פעם אחת';
  if (count === 2) return 'כן · פעמיים';
  return `כן · ${count} פעמים`;
}

function latestNote(article) {
  const notes = article.editorNotes || [];
  if (notes.length) {
    const newest = notes.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
    return newest.text;
  }
  if (article.status === STATUS.PENDING) return 'הוגשה לעורך — ממתינה לבדיקה';
  return EMPTY;
}

// Turns an article from the database into one row of the table in views/reporter.ejs
function toReporterRow(article, authorName) {
  const isPublished = article.status === STATUS.PUBLISHED;

  return {
    id: String(article._id),
    title: article.title,
    category: article.category,
    author: authorName,
    updated: formatRelative(article.updatedAt),
    published: article.publishedAt ? formatDateTime(article.publishedAt) : EMPTY,
    status: STATUS_LABELS[article.status],
    returned: formatReturned(article.returnedCount),
    notes: latestNote(article),
    views: isPublished ? (article.views || 0).toLocaleString('en-US') : EMPTY,
  };
}

module.exports = { toReporterRow };
