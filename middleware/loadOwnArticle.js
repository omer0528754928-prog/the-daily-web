const articleService = require('../services/articleService');
const { HttpError } = require('../utils/HttpError');

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Loads the article from :id into req.article, but only if it belongs to the logged-in user.
// Someone else's article gets the same 404 as a missing one, so ids can't be probed.
async function loadOwnArticle(req, res, next) {
  const { id } = req.params;
  if (!OBJECT_ID.test(id)) throw new HttpError(404, 'Article not found');

  const article = await articleService.findOwnArticle(req.session.user.id, id);
  if (!article) throw new HttpError(404, 'Article not found');

  req.article = article;
  next();
}

module.exports = loadOwnArticle;
