const editorService = require('../services/editorService');
const { HttpError } = require('../utils/HttpError');

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Loads any article from :id into req.article (for the editor, who sees all reporters'
// articles). An invalid or missing id gets a 404.
async function loadArticle(req, res, next) {
  const { id } = req.params;
  if (!OBJECT_ID.test(id)) throw new HttpError(404, 'Article not found');

  const article = await editorService.findById(id);
  if (!article) throw new HttpError(404, 'Article not found');

  req.article = article;
  next();
}

module.exports = loadArticle;
