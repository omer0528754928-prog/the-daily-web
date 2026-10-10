const Article = require('../models/Article');
const { STATUS, EDITOR_TRANSITIONS, canTransition } = require('../config/articleStatus');
const { HttpError } = require('../utils/HttpError');
const { validateForSubmit, validateImage } = require('../validators/articleValidator');
const { saveArticleImage, deleteArticleImage } = require('./imageStorage');

// Fields needed for the editor queue (body is large, so it is left out)
const LIST_FIELDS =
  'title category status version editorNotes returnedCount views submittedAt liveVersion.version liveVersion.publishedAt author updatedAt';
const CONTENT_FIELDS = ['title', 'summary', 'body', 'category'];

// The editor sees every reporter's articles, so the filter has no author restriction.
// It reuses the same column filters as the reporter table (see middleware/articleFilters).
function buildFilter(filters = {}) {
  const filter = {};
  if (filters.category?.length) filter.category = { $in: filters.category };
  if (filters.status?.length) filter.status = { $in: filters.status };
  if (filters.returned === 'yes') filter.returnedCount = { $gt: 0 };
  if (filters.returned === 'no') filter.returnedCount = 0;
  if (filters.publishedFrom || filters.publishedTo) {
    filter['liveVersion.publishedAt'] = {
      ...(filters.publishedFrom ? { $gte: filters.publishedFrom } : {}),
      ...(filters.publishedTo ? { $lte: filters.publishedTo } : {}),
    };
  }
  return filter;
}

// The editor queue: all articles (all authors), newest first, with an optional status filter
async function listAll({ filters, limit = 0, skip = 0 } = {}) {
  const filter = buildFilter(filters);
  const [items, total] = await Promise.all([
    Article.find(filter)
      .select(LIST_FIELDS)
      .populate('author', 'name')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Article.countDocuments(filter),
  ]);
  return { items, total };
}

function countAll() {
  return Article.countDocuments({});
}

// One article (any author), with the reporter's name and every editor note's author
function findById(articleId) {
  return Article.findById(articleId)
    .populate('author', 'name')
    .populate('editorNotes.by', 'name')
    .lean();
}

// The editor may fix the submitted text himself, but only while it waits for approval.
async function editContent(articleId, input = {}, file) {
  const article = await Article.findById(articleId);
  if (!article) throw new HttpError(404, 'Article not found');
  if (article.status !== STATUS.PENDING) {
    throw new HttpError(409, 'Only an article waiting for approval can be edited by the editor');
  }

  const merged = Object.fromEntries(CONTENT_FIELDS.map(field => [field, input[field] ?? article[field]]));
  const { value: content, errors: contentErrors } = validateForSubmit(merged);
  const imageResult = validateImage(file);
  const errors = { ...contentErrors };
  if (imageResult.error) errors.image = imageResult.error;
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

  const newImageUrl = imageResult.value ? await saveArticleImage(imageResult.value) : null;
  const imageUrl = newImageUrl ?? article.image;
  const live = article.liveVersion;
  const differs = live && (CONTENT_FIELDS.some(field => content[field] !== live[field]) || imageUrl !== live.image);

  const update = { ...content, image: imageUrl };
  // The first change after an approval starts a new version (same rule as the reporter side)
  if (differs && article.version === live.version) update.version = article.version + 1;

  // Guard on status+version so two editors can't step on each other
  const saved = await Article.findOneAndUpdate(
    { _id: article._id, status: STATUS.PENDING, version: article.version },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  )
    .populate('author', 'name')
    .populate('editorNotes.by', 'name')
    .lean();

  if (!saved) {
    await deleteArticleImage(newImageUrl);
    throw new HttpError(409, 'The article changed in the meantime. Reload and try again');
  }
  return saved;
}

// Approve & publish: pending -> published. The working copy becomes the public liveVersion.
async function approve(articleId) {
  const article = await Article.findById(articleId);
  if (!article) throw new HttpError(404, 'Article not found');
  if (!canTransition(EDITOR_TRANSITIONS, article.status, STATUS.PUBLISHED)) {
    throw new HttpError(409, `An editor cannot publish an article in status "${article.status}"`);
  }

  const liveVersion = {
    title: article.title,
    summary: article.summary,
    body: article.body,
    category: article.category,
    image: article.image,
    version: article.version,
    publishedAt: new Date(),
  };

  const saved = await Article.findOneAndUpdate(
    { _id: article._id, status: STATUS.PENDING, version: article.version },
    { $set: { status: STATUS.PUBLISHED, liveVersion }, $unset: { submittedAt: '', republishAt: '' } },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!saved) throw new HttpError(409, 'The article changed in the meantime. Reload and try again');
  return saved;
}

// Return to the reporter with a note. Allowed from "pending" (a submitted version) and
// from "published" (send a live article back for corrections). The note is required.
// The last approved version (liveVersion) stays public and untouched in both cases.
async function returnToReporter(articleId, editorId, noteText) {
  const text = typeof noteText === 'string' ? noteText.trim() : '';
  if (!text) throw new HttpError(400, 'A note is required when returning an article', { note: 'Note is required' });

  const article = await Article.findById(articleId);
  if (!article) throw new HttpError(404, 'Article not found');
  if (!canTransition(EDITOR_TRANSITIONS, article.status, STATUS.RETURNED)) {
    throw new HttpError(409, `An editor cannot return an article in status "${article.status}"`);
  }

  // Guard on the current status (+ version) so a concurrent change is not overwritten
  const saved = await Article.findOneAndUpdate(
    { _id: article._id, status: article.status, version: article.version },
    {
      $set: { status: STATUS.RETURNED },
      $push: { editorNotes: { text, by: editorId, createdAt: new Date() } },
      $inc: { returnedCount: 1 },
      $unset: { submittedAt: '' },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!saved) throw new HttpError(409, 'The article changed in the meantime. Reload and try again');
  return saved;
}

// Delete an article and clean up its images
async function remove(articleId) {
  const article = await Article.findByIdAndDelete(articleId).lean();
  if (!article) throw new HttpError(404, 'Article not found');
  await deleteArticleImage(article.image);
  if (article.liveVersion?.image && article.liveVersion.image !== article.image) {
    await deleteArticleImage(article.liveVersion.image);
  }
  return article;
}

module.exports = { listAll, countAll, findById, editContent, approve, returnToReporter, remove };
