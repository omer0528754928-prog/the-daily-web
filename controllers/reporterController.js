const articleService = require('../services/articleService');
const { toReporterRow } = require('../presenters/reporterArticlePresenter');
const { newArticle, toArticleForm, toProblemMessages } = require('../presenters/articleFormPresenter');

// The form sends action=save ("שמירת טיוטה") or action=submit ("שליחה לאישור עורך")
function isSubmit(req) {
  return req.body?.action === 'submit';
}

// GET /reporter: the reporter's own articles and their status
async function showDashboard(req, res) {
  const { id, name } = req.session.user;
  const { items } = await articleService.listByAuthor(id);

  res.render('reporter', {
    reporterName: name,
    myArticles: items.map(article => toReporterRow(article, name)),
  });
}

// GET /reporter/articles/new
function showNewArticleForm(req, res) {
  res.render('article-form', { mode: 'new', article: toArticleForm(newArticle(), req.session.user.name) });
}

// GET /reporter/articles/:id (read only, including editor notes)
function showArticle(req, res) {
  res.render('article-form', { mode: 'view', article: toArticleForm(req.article, req.session.user.name) });
}

// GET /reporter/articles/:id/edit
function showEditArticleForm(req, res) {
  res.render('article-form', { mode: 'edit', article: toArticleForm(req.article, req.session.user.name) });
}

// Re-opens the form with the text the reporter typed and a red box listing what to fix
function showProblems(req, res, error, { mode, article }) {
  if (!error.details) throw error;
  res.status(error.status).render('article-form', {
    mode,
    article: toArticleForm(article, req.session.user.name, req.body),
    problems: toProblemMessages(error.details),
  });
}

// POST /reporter/articles
async function createArticle(req, res) {
  const submit = isSubmit(req);
  try {
    const article = await articleService.createArticle(req.session.user.id, req.body, req.file, { submit });
    res.redirect(submit ? '/reporter' : `/reporter/articles/${article._id}/edit`);
  } catch (error) {
    showProblems(req, res, error, { mode: 'new', article: newArticle() });
  }
}

// POST /reporter/articles/:id
async function updateArticle(req, res) {
  const submit = isSubmit(req);
  try {
    const article = await articleService.saveArticle(req.article, req.body, req.file, { submit });
    res.redirect(submit ? '/reporter' : `/reporter/articles/${article._id}/edit`);
  } catch (error) {
    showProblems(req, res, error, { mode: 'edit', article: req.article });
  }
}

module.exports = {
  showDashboard,
  showNewArticleForm,
  showArticle,
  showEditArticleForm,
  createArticle,
  updateArticle,
};
