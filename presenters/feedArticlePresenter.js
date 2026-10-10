const { formatRelative } = require('../utils/dates');
const categoryToImage = require('../config/categoryImages');

// Turns a published article from the database into one card on views/home.ejs (and the feed JSON)
function toFeedCard(article) {
  const live = article.liveVersion;

  return {
    id: String(article._id),
    title: live.title,
    summary: live.summary,
    category: live.category,
    image: live.image || categoryToImage[live.category], // no image -> the category's placeholder
    reporter: article.author?.name, // ?. in case the reporter's user was deleted
    date: formatRelative(live.publishedAt),
    views: article.views.toLocaleString('en-US'), // 12345 -> "12,345"
  };
}

module.exports = { toFeedCard };