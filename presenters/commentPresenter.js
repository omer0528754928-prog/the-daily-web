const { formatRelative } = require('../utils/dates');
const { LIMITS } = require('../validators/commentValidator');

// Same text as the rateLimited message in views/article.ejs
const RATE_LIMITED_MESSAGE = 'חרגת מהמגבלה — נסו שוב בעוד דקה';

// The validator's messages are in English (like the API); the page shows these instead
const FIELD_PROBLEMS = {
  text: `יש לכתוב תגובה באורך של עד ${LIMITS.text} תווים`,
  authorName: `השם יכול להכיל עד ${LIMITS.authorName} תווים`,
};

// One comment as views/article.ejs shows it
function toPublicComment(comment) {
  return {
    id: String(comment._id),
    name: comment.authorName,
    text: comment.text,
    time: formatRelative(comment.createdAt),
    // Machine-readable date for <time datetime="...">
    createdAt: new Date(comment.createdAt).toISOString(),
  };
}

function toCommentProblems(details = {}) {
  return Object.keys(details).map(field => FIELD_PROBLEMS[field] || details[field]);
}

// The JSON body of a 400 from the comments API: the usual error and details,
// plus "messages" in Hebrew, which public/js/comments.js shows next to the form
function toValidationProblem(error) {
  return { error: error.message, details: error.details, messages: toCommentProblems(error.details) };
}

// What the guest typed, to put back in the form after an error (only strings, never arrays)
function toCommentForm(body = {}) {
  const pick = value => (typeof value === 'string' ? value : '');
  return { name: pick(body.name), text: pick(body.text) };
}

module.exports = { RATE_LIMITED_MESSAGE, toPublicComment, toCommentProblems, toValidationProblem, toCommentForm };
