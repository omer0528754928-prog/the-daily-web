// The back link at the top of an article. Without JavaScript, or when the article was opened
// from outside the site (a shared link, a search engine), it simply goes to the home page.
// When the reader came from a page of this site, it goes back in the browser history instead,
// so the feed comes back with the same scroll position, filters and search.
(function () {
  const link = document.querySelector('[data-back-link]');
  if (!link) return;

  let previous = null;
  try {
    previous = document.referrer ? new URL(document.referrer) : null;
  } catch {
    previous = null;
  }

  // After sending the comment form without JS the page comes back to itself; "back" would
  // then show the same article again, so the link keeps going to the home page
  const cameFromAnotherPageHere = previous
    && previous.origin === location.origin
    && previous.pathname !== location.pathname;
  if (!cameFromAnotherPageHere || history.length < 2) return;

  link.addEventListener('click', event => {
    event.preventDefault();
    history.back();
  });
})();
