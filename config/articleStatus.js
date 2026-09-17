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

module.exports = { STATUS, STATUS_LABELS };
