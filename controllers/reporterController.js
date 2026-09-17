const articleService = require('../services/articleService');
const { toReporterRow } = require('../presenters/reporterArticlePresenter');

// GET /reporter: the reporter's own articles and their status
async function showDashboard(req, res) {
  const { id, name } = req.session.user;
  const { items } = await articleService.listByAuthor(id);

  res.render('reporter', {
    reporterName: name,
    myArticles: items.map(article => toReporterRow(article, name)),
  });
}

// Pages below still show the design's sample data; they get real logic in the next features
function showNewArticleForm(req, res) {
  res.render('article-form', { mode: 'new' });
}

function showArticle(req, res) {
  res.render('article-form', { mode: 'view', id: req.params.id });
}

function showEditArticleForm(req, res) {
  res.render('article-form', { mode: 'edit', id: req.params.id });
}

module.exports = { showDashboard, showNewArticleForm, showArticle, showEditArticleForm };
