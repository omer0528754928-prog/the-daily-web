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

// A reporter may send the article to the editor from these statuses.
// Only the editor moves an article to "published".
const SUBMITTABLE_STATUSES = Object.freeze([STATUS.DRAFT, STATUS.RETURNED, STATUS.PUBLISHED]);

module.exports = { STATUS, STATUS_LABELS, EDITABLE_STATUSES, SUBMITTABLE_STATUSES };
