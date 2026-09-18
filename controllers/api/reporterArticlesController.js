const articleService = require('../../services/articleService');
const { toArticleSummary, toArticleDetail } = require('../../presenters/articleApiPresenter');

// GET /api/reporter/articles?limit=&skip=
async function listMyArticles(req, res) {
  const { limit, skip } = req.pagination;
  const { items, total } = await articleService.listByAuthor(req.session.user.id, { limit, skip });

  res.json({
    data: items.map(toArticleSummary),
    meta: { total, limit, skip },
  });
}

// POST /api/reporter/articles: always creates a draft; send it with POST /:id/submit
async function createArticle(req, res) {
  const article = await articleService.createArticle(req.session.user.id, req.body ?? {}, req.file);
  res.status(201).location(`/api/reporter/articles/${article._id}`).json({ data: toArticleDetail(article) });
}

// GET /api/reporter/articles/:id
function getArticle(req, res) {
  res.json({ data: toArticleDetail(req.article) });
}

// PATCH /api/reporter/articles/:id: only the fields sent are changed
async function updateArticle(req, res) {
  const article = await articleService.saveArticle(req.article, req.body ?? {}, req.file);
  res.json({ data: toArticleDetail(article) });
}

// POST /api/reporter/articles/:id/submit: send to the editor for approval
async function submitArticle(req, res) {
  const article = await articleService.submitArticle(req.article);
  res.json({ data: toArticleDetail(article) });
}

module.exports = { listMyArticles, createArticle, getArticle, updateArticle, submitArticle };
