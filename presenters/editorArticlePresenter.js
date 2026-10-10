const { STATUS, STATUS_LABELS } = require('../config/articleStatus');
const { formatDateTime, formatRelative } = require('../utils/dates');

const EMPTY = '—';

// "גרסה 3 · מפורסמת מ־10.09" for the public version, or "—" if never published
function liveLabel(article) {
  if (!article.liveVersion) return EMPTY;
  const day = formatDateTime(article.liveVersion.publishedAt).slice(0, 5); // "10.09"
  return `גרסה ${article.liveVersion.version} · מפורסמת מ־${day}`;
}

// "גרסה 4" for the version waiting for approval, or "—"
function pendingLabel(article) {
  return article.status === STATUS.PENDING ? `גרסה ${article.version}` : EMPTY;
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

// One row of the editor queue (views/editor.ejs)
function toEditorRow(article) {
  return {
    id: String(article._id),
    title: article.title,
    reporter: article.author?.name ?? EMPTY,
    category: article.category,
    updated: formatRelative(article.submittedAt || article.updatedAt),
    status: STATUS_LABELS[article.status],
    statusKey: article.status,
    live: liveLabel(article),
    pending: pendingLabel(article),
  };
}

// The single-article review screen (views/review.ejs).
// input (optional) is the text the editor just typed, shown again when a save failed.
function toReviewView(article, input = {}) {
  const pick = field => (typeof input[field] === 'string' ? input[field] : article[field]);
  const live = article.liveVersion;

  return {
    id: String(article._id),
    status: STATUS_LABELS[article.status],
    statusKey: article.status,
    reporter: article.author?.name ?? EMPTY,
    category: article.category,
    updated: formatRelative(article.submittedAt || article.updatedAt),
    isPending: article.status === STATUS.PENDING,
    isUpdate: Boolean(live),
    // The working copy = the submitted text (also what the editor edits and what waits for approval)
    working: {
      title: pick('title'),
      summary: pick('summary'),
      body: pick('body'),
      category: pick('category'),
      image: article.image,
      version: article.version,
    },
    // The public version (what readers see now)
    live: live
      ? {
          version: live.version,
          title: live.title,
          summary: live.summary,
          body: live.body,
          image: live.image,
          publishedAt: formatDateTime(live.publishedAt),
        }
      : null,
    notes: toNoteRows(article.editorNotes),
  };
}

module.exports = { toEditorRow, toReviewView };
