const { formatRelative } = require('../utils/dates');

// Turns a published article from the database into one card on views/home.ejs (and the feed JSON)
function toFeedCard(article) {
  const live = article.liveVersion;

  return {
    id: String(article._id),
    title: live.title,
    summary: live.summary,
    category: live.category,
    image: live.image,
    reporter: article.author?.name,
    date: formatRelative(live.publishedAt),
    views: article.views.toLocaleString('en-US'),
  };
}

module.exports = { toFeedCard };