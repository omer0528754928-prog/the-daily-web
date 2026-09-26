const publicArticleService = require('../services/publicArticleService');
const { HttpError } = require('../utils/HttpError');

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Loads the public version of the article from :id into req.article.
// A malformed id, a missing article and one that was never approved all get the same 404,
// and the id is checked before the query so a bad value never reaches MongoDB.
async function loadPublicArticle(req, res, next) {
  const { id } = req.params;
  if (!OBJECT_ID.test(id)) throw new HttpError(404, 'Article not found');

  const article = await publicArticleService.findPublicArticle(id);
  if (!article) throw new HttpError(404, 'Article not found');

  req.article = article;
  next();
}

module.exports = loadPublicArticle;
