const statsService = require('../services/statsService');
const { getActiveAuthenticatedUserCount } = require('../services/sessionMonitoringService');

// GET /stats : Impact Analytics for the editor.
// The editor picks a published article and sees its views over time, with the
// points where an update was approved marked on the graph.
async function showStats(req, res) {
  const articles = await statsService.listPublishedArticles();

  // A live, site-wide number from the session store (never breaks the page if it fails)
  const connectedUsers = await getActiveAuthenticatedUserCount().catch(() => null);
  const picker = articles.map(article => ({ key: String(article._id), label: article.title }));

  // Keep the chosen article from the query string, or fall back to the first one
  const wanted = typeof req.query.article === 'string' ? req.query.article : '';
  const selectedKey = picker.some(item => item.key === wanted) ? wanted : picker[0]?.key || '';

  let selected = null;
  let kpis = [];
  if (selectedKey) {
    const label = picker.find(item => item.key === selectedKey).label;
    const stats = await statsService.getArticleStats(selectedKey);
    selected = { key: selectedKey, label, views: stats.counts, labels: stats.labels, updates: stats.updates };
    kpis = stats.kpis;
  }

  res.render('stats', {
    currentUser: req.session.user,
    query: req.query,
    picker,
    selected,
    kpis,
    connectedUsers,
  });
}

module.exports = { showStats };
