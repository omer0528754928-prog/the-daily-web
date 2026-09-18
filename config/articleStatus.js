// Stored in the database in English; shown to users in Hebrew
const STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  RETURNED: 'returned',
  PUBLISHED: 'published',
});

// These labels must match the data-status colors in public/css/style.css
const STATUS_LABELS = Object.freeze({
  [STATUS.DRAFT]: 'בהכנה',
  [STATUS.PENDING]: 'ממתינה לאישור',
  [STATUS.RETURNED]: 'הוחזרה לתיקונים',
  [STATUS.PUBLISHED]: 'פורסמה',
});

// A reporter may change the text only in these statuses (not while the editor is reviewing)
const EDITABLE_STATUSES = Object.freeze([STATUS.DRAFT, STATUS.RETURNED, STATUS.PUBLISHED]);

// The only status changes allowed, by who is allowed to make them.
// Anything not listed here is rejected: a reporter can never publish, and an
// article waiting for the editor cannot move until the editor decides.
const REPORTER_TRANSITIONS = Object.freeze({
  [STATUS.DRAFT]: [STATUS.PENDING],      // send a new article to the editor
  [STATUS.RETURNED]: [STATUS.PENDING],   // resend after fixing the editor's notes
  [STATUS.PUBLISHED]: [STATUS.PENDING],  // send an update of a published article
});

const EDITOR_TRANSITIONS = Object.freeze({
  [STATUS.PENDING]: [STATUS.PUBLISHED, STATUS.RETURNED],
});

// A reporter may send the article to the editor from these statuses
const SUBMITTABLE_STATUSES = Object.freeze(Object.keys(REPORTER_TRANSITIONS));

function canTransition(transitions, from, to) {
  return (transitions[from] || []).includes(to);
}

module.exports = {
  STATUS,
  STATUS_LABELS,
  EDITABLE_STATUSES,
  SUBMITTABLE_STATUSES,
  REPORTER_TRANSITIONS,
  EDITOR_TRANSITIONS,
  canTransition,
};
