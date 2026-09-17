const articleService = require('../../services/articleService');
const { toArticleSummary } = require('../../presenters/articleApiPresenter');

// GET /api/reporter/articles?limit=&skip=
async function listMyArticles(req, res) {
  const { limit, skip } = req.pagination;
  const { items, total } = await articleService.listByAuthor(req.session.user.id, { limit, skip });

  res.json({
    data: items.map(toArticleSummary),
    meta: { total, limit, skip },
  });
}

module.exports = { listMyArticles };
