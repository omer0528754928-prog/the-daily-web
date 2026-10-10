const { formatDateTime, formatRelative } = require('../utils/dates');
const CATEGORY_IMAGES = require('../config/categoryImages');

// Shown if the reporter's user was deleted, so the byline is never empty
const UNKNOWN_AUTHOR = 'מערכת The Daily Web';

// The body is plain text with a blank line between paragraphs
function toParagraphs(body) {
  return (body || '')
    .split(/\r?\n\s*\r?\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

function authorName(article) {
  return article.author?.name || UNKNOWN_AUTHOR;
}

// Turns a public article from the database into what views/article.ejs shows.
// Everything comes from liveVersion, the copy the editor approved.
function toPublicArticle(article) {
  const live = article.liveVersion;
  return {
    id: String(article._id),
    title: live.title,
    summary: live.summary,
    category: live.category,
    reporter: authorName(article),
    date: formatDateTime(live.publishedAt),
    // Machine-readable date for <time datetime="...">
    publishedAt: new Date(live.publishedAt).toISOString(),
    views: (article.views || 0).toLocaleString('en-US'),
    paragraphs: toParagraphs(live.body),
    // No uploaded image: the same category illustration as the article's card on the home page
    image: live.image || CATEGORY_IMAGES[live.category] || null,
    // A real photo is described by the title; the category illustration is decoration (alt="")
    imageAlt: live.image ? live.title : '',
  };
}

// One line in the "more in this category" sidebar
function toRelatedItem(article) {
  return {
    id: String(article._id),
    title: article.liveVersion.title,
    reporter: authorName(article),
    date: formatRelative(article.liveVersion.publishedAt),
    publishedAt: new Date(article.liveVersion.publishedAt).toISOString(),
  };
}

module.exports = { toPublicArticle, toRelatedItem, toParagraphs };
