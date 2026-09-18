const mongoose = require('mongoose');
const { isApiRequest } = require('../utils/HttpError');
const { toProblemMessages } = require('../presenters/articleFormPresenter');

// Messages shown on HTML pages (the API returns the error's own message)
const PAGE_MESSAGES = {
  400: 'הבקשה אינה תקינה',
  404: 'העמוד לא נמצא',
  409: 'לא ניתן לבצע את הפעולה במצב הנוכחי של הכתבה',
  413: 'הקובץ גדול מדי',
  422: 'לא ניתן לשלוח את הכתבה לאישור עורך',
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// A small page telling the reporter what to fix, with a link back to the form.
// The browser's back button brings the typed text back.
function renderProblemPage(res, status, details) {
  const items = toProblemMessages(details).map(text => `<li>${escapeHtml(text)}</li>`).join('');

  res.status(status).send(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(PAGE_MESSAGES[status] || 'שגיאה')} · The Daily Web</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <main class="container container--form page">
    <section class="card panel">
      <h1 class="panel__title">${escapeHtml(PAGE_MESSAGES[status] || 'אירעה שגיאה')}</h1>
      <p class="hint">יש לתקן את הפרטים הבאים:</p>
      <ul class="hint">${items}</ul>
      <p><a href="javascript:history.back()" class="btn btn-primary">חזרה לעריכה</a></p>
    </section>
  </main>
</body>
</html>`);
}

function notFound(req, res) {
  if (isApiRequest(req)) return res.status(404).json({ error: 'Not found' });
  res.status(404).send(PAGE_MESSAGES[404]);
}

// Turns database validation errors into 400 instead of a server error
function normalizeError(err) {
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(err.errors).map(([field, e]) => [field, e.message]));
    return { status: 400, message: 'Validation failed', details };
  }
  if (err instanceof mongoose.Error.CastError) {
    return { status: 400, message: `Invalid value for "${err.path}"` };
  }
  return { status: err.status || 500, message: err.message, details: err.details };
}

// Express calls this with 4 arguments when a route throws or calls next(error)
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const { status, message, details } = normalizeError(err);
  if (status >= 500) console.error(err);

  if (isApiRequest(req)) {
    const body = { error: status >= 500 ? 'Internal server error' : message };
    if (details) body.details = details;
    return res.status(status).json(body);
  }

  if (details) return renderProblemPage(res, status, details);
  res.status(status).send(PAGE_MESSAGES[status] || 'אירעה שגיאה בשרת');
}

module.exports = { notFound, errorHandler };
