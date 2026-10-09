// The articles this device already opened, for the "לא נצפו" filter (kept in localStorage).
// Shared by the home page (feed.js reads the list) and the article page, which adds itself to the list
// when it loads, so an article counts as read however it was opened (feed, related links, a shared link).
// Loaded before feed.js; everything else stays inside the function so it doesn't leak into the page.
window.ReadArticles = (() => {
  const READ_KEY = 'readArticles';
  const MAX_READ = 200; // must match MAX_SEEN_IDS in middleware/feedFilters.js
  const OBJECT_ID = /^[0-9a-f]{24}$/i; // same check as in middleware/feedFilters.js

  // The read list from localStorage. Anything that isn't a list of real ids (an old value, an edit by hand)
  // is dropped, so a bad value can't make every "unseen" request fail with a 400.
  const getIds = () => {
    let readArticles;
    try {
      readArticles = JSON.parse(localStorage.getItem(READ_KEY));
    } catch {
      readArticles = []; // storage blocked (e.g. private mode) or not valid JSON
    }
    if (!Array.isArray(readArticles)) return [];
    return readArticles.filter(id => typeof id === 'string' && OBJECT_ID.test(id));
  };

  // Puts an opened article first in the read list (moving it if it was already there) and keeps the newest MAX_READ
  const markRead = (id) => {
    if (!OBJECT_ID.test(id)) return;
    const rest = getIds().filter(readId => readId !== id);
    const updated = [id, ...rest].slice(0, MAX_READ);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(updated));
    } catch {
      // storage is blocked (e.g. private mode): the filter just won't know about this article
    }
  };

  // On the article page: remember this article
  const article = document.querySelector('.article[data-article-id]');
  if (article) markRead(article.dataset.articleId);

  return { getIds, markRead };
})();
