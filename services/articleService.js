const Article = require('../models/Article');
const { STATUS, EDITABLE_STATUSES, REPORTER_TRANSITIONS, canTransition } = require('../config/articleStatus');
const { HttpError } = require('../utils/HttpError');
const {
  validateDraft,
  validateForSubmit,
  validateRepublishAt,
  validateImage,
} = require('../validators/articleValidator');
const { saveArticleImage, deleteArticleImage } = require('./imageStorage');

// Fields needed for article lists (the body is large, so it is left out)
const LIST_FIELDS = 'title category status version editorNotes returnedCount views liveVersion.version liveVersion.publishedAt updatedAt';
const CONTENT_FIELDS = ['title', 'summary', 'body', 'category'];

// Turns the column filters from the reporter table into a MongoDB query
function buildFilter(authorId, filters = {}) {
  const filter = { author: authorId };

  if (filters.category?.length) filter.category = { $in: filters.category };
  if (filters.status?.length) filter.status = { $in: filters.status };
  if (filters.returned === 'yes') filter.returnedCount = { $gt: 0 };
  if (filters.returned === 'no') filter.returnedCount = 0;

  // The publish date lives on the approved version, so this also excludes
  // articles that were never published
  if (filters.publishedFrom || filters.publishedTo) {
    filter['liveVersion.publishedAt'] = {
      ...(filters.publishedFrom ? { $gte: filters.publishedFrom } : {}),
      ...(filters.publishedTo ? { $lte: filters.publishedTo } : {}),
    };
  }

  return filter;
}

async function listByAuthor(authorId, { filters, limit = 0, skip = 0 } = {}) {
  const filter = buildFilter(authorId, filters);

  const [items, total] = await Promise.all([
    Article.find(filter)
      .select(LIST_FIELDS)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Article.countDocuments(filter),
  ]);

  return { items, total };
}

// How many articles the reporter has in total, ignoring the column filters
function countByAuthor(authorId) {
  return Article.countDocuments({ author: authorId });
}

// Returns the article only if it belongs to this author, otherwise null
function findOwnArticle(authorId, articleId) {
  return Article.findOne({ _id: articleId, author: authorId })
    .populate('editorNotes.by', 'name')
    .lean();
}

// Runs the right validation for the action and throws one error listing every problem
function validateInput({ content, file, republishAt }, { submit, canRepublish }) {
  const contentResult = submit ? validateForSubmit(content) : validateDraft(content);
  const imageResult = validateImage(file);
  const republishResult = canRepublish ? validateRepublishAt(republishAt) : { value: undefined };

  const errors = { ...contentResult.errors };
  if (imageResult.error) errors.image = imageResult.error;
  if (republishResult.error) errors.republishAt = republishResult.error;

  if (Object.keys(errors).length) {
    // 422 = the input is valid, but the article is not complete enough to send to the editor
    const onlyMissingForSubmit = submit && Object.keys(errors).every(field => field === 'body');
    const status = onlyMissingForSubmit ? 422 : 400;
    throw new HttpError(status, 'Validation failed', errors);
  }

  return { content: contentResult.value, image: imageResult.value, republishAt: republishResult.value };
}

function differsFromLive(content, image, liveVersion) {
  return CONTENT_FIELDS.some(field => content[field] !== liveVersion[field]) || image !== liveVersion.image;
}

// Every article starts as a draft. With submit: true it is then sent to the editor,
// which is the normal Draft -> Pending change, so no article skips the draft step.
async function createArticle(authorId, input, file, { submit = false } = {}) {
  // Checked before creating, so an incomplete article does not leave a stray draft behind
  const { content, image } = validateInput({ content: input, file }, { submit, canRepublish: false });

  const imageUrl = image ? await saveArticleImage(image) : null;
  let article;
  try {
    article = (await Article.create({
      ...content,
      image: imageUrl,
      author: authorId,
      version: 1,
      status: STATUS.DRAFT,
    })).toObject();
  } catch (error) {
    await deleteArticleImage(imageUrl);
    throw error;
  }

  return submit ? submitArticle(article) : article;
}

// Saves changes to an existing article (fields left out of input keep their current value).
// With submit: true it also sends the article to the editor. It never publishes.
async function saveArticle(article, input = {}, file, { submit = false } = {}) {
  if (!EDITABLE_STATUSES.includes(article.status)) {
    throw new HttpError(409, 'Article is waiting for editor approval and cannot be changed');
  }
  if (submit && !canTransition(REPORTER_TRANSITIONS, article.status, STATUS.PENDING)) {
    throw new HttpError(409, `A reporter cannot move an article from "${article.status}" to "pending"`);
  }

  const merged = Object.fromEntries(CONTENT_FIELDS.map(field => [field, input[field] ?? article[field]]));
  const live = article.liveVersion;

  // Checked before validation: sending an unchanged published article is never allowed
  if (submit && live && !file && !input.republishAt && !differsFromLive(merged, article.image, live)) {
    throw new HttpError(409, 'Nothing to send: the article is the same as the published version');
  }

  const { content, image, republishAt } = validateInput(
    { content: merged, file, republishAt: input.republishAt },
    { submit, canRepublish: Boolean(article.liveVersion) },
  );

  const newImageUrl = image ? await saveArticleImage(image) : null;
  const imageUrl = newImageUrl ?? article.image;
  const hasChanges = live && differsFromLive(content, imageUrl, live);

  if (submit && live && !hasChanges && !republishAt) {
    await deleteArticleImage(newImageUrl);
    throw new HttpError(409, 'Nothing to send: the article is the same as the published version');
  }

  const update = { ...content, image: imageUrl };
  // The first change after an approval starts a new version
  if (hasChanges && article.version === live.version) update.version = article.version + 1;
  if (republishAt) update.republishAt = republishAt;
  if (submit) {
    update.status = STATUS.PENDING;
    update.submittedAt = new Date();
  }

  // Only update if nobody changed the article since it was loaded (e.g. the same article open in two tabs)
  const saved = await Article.findOneAndUpdate(
    { _id: article._id, author: article.author, status: article.status, version: article.version },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  )
    .populate('editorNotes.by', 'name')
    .lean();

  if (!saved) {
    await deleteArticleImage(newImageUrl);
    throw new HttpError(409, 'The article was changed in the meantime. Reload it and try again');
  }
  return saved;
}

function submitArticle(article) {
  return saveArticle(article, {}, undefined, { submit: true });
}

module.exports = { listByAuthor, countByAuthor, findOwnArticle, createArticle, saveArticle, submitArticle };
