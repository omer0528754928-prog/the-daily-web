const publicArticleService = require('../services/publicArticleService');
const { toPublicArticle, toRelatedItem } = require('../presenters/publicArticlePresenter');

// GET /articles/:id: the whole article is rendered on the server, so its full text
// is already in the first HTML response (search engines and readers without JS see it)
async function showArticle(req, res) {
  const { article } = req;
  const related = await publicArticleService.findRelated(article.liveVersion.category, article._id);

  res.render('article', {
    article: toPublicArticle(article),
    related: related.map(toRelatedItem),
  });
}

module.exports = { showArticle };
