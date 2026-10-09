// Home page feed: infinite scroll (loads more cards from /api/feed near the bottom of the page)
// and changing the category / search / sort / view without reloading the page.
// The "לא נצפו" view uses the read list from readArticles.js (the article page adds itself to it).
// Everything is inside a function that runs right away, so its variables don't leak into the page.
(() => {
  const LIMIT = 20; // cards per batch, same as the first batch the server renders
  // The articles this device already opened (see public/js/readArticles.js, loaded before this file)
  const getReadIds = window.ReadArticles.getIds;
  // An empty element under the grid; when it gets near the screen, the next batch is shown
  const sentinel = document.querySelector('.refresh-sentinel');
  const template = document.getElementById('grid-card-template');
  const grid = document.getElementById('feed-grid');
  // The lead + side cards. The server renders them only on the plain home page (no filters)
  const topStories = document.querySelector('.top-stories');

  if (!sentinel || !grid || !template) return; // not the home page

  // Where the server stopped: whether there are more articles, and how many it already rendered
  let hasMore = sentinel.dataset.hasMore === 'true';
  let nextSkip = Number(sentinel.dataset.nextSkip);
  let loading = false; // a batch is being shown right now, don't start another one
  // Goes up on every filter change, so responses for an old filter can be ignored
  let generation = 0;
  const cardTemplate = template.content.firstElementChild; // the <a class="card grid-card"> inside <template>

  // Ids of the cards already on the page, so a batch never adds the same article twice
  const seen = new Set([...document.querySelectorAll('.feed [data-id]')].map(card => card.dataset.id));
  // Kept so the lead + side cards can be counted as "seen" again after going back to the plain home page
  const topStoryIds = topStories ? [...topStories.querySelectorAll('[data-id]')].map(card => card.dataset.id) : [];

  // Same rule as isFiltered in views/home.ejs: any category, search, sort or the "unseen" view means a plain grid
  const isFiltered = (params) => ['category', 'q', 'sort'].some(key => params.get(key)) || params.get('view') === 'unseen';

  // One batch of cards from the API, with the same filters as the current page
  const fetchBatch = async (skip = 0) => {
    // the page URL already has the filters (category, q, sort, view), only skip and limit are added
    const params = new URLSearchParams(location.search);
    params.set('skip', skip);
    params.set('limit', LIMIT);
    // the server can't read localStorage, so the "unseen" view sends the read list with the request
    if (params.get('view') === 'unseen') {
      params.set('seen', getReadIds().join(','));
    }

    const response = await fetch('/api/feed?' + params);
    if (!response.ok) throw new Error('cant fetch new data');
    return response.json();
  };

  // The next batch is fetched ahead of time, so it's ready before the reader reaches the bottom.
  // nextBatch is the promise of that request, loadMore() awaits it when it's time to show the cards.
  let nextBatch = hasMore ? fetchBatch(nextSkip) : null;

  // Clones the empty card from the template and fills it (textContent, so titles can't inject HTML;
  // the image is the one field that goes into an attribute instead)
  const buildCard = (card) => {
    const newCard = cardTemplate.cloneNode(true); // true = copy the children too
    // Each field of the card JSON goes into the element with the same data-field (fields without one are skipped)
    Object.entries(card).forEach(([key, value]) => {
      const el = newCard.querySelector(`[data-field="${key}"]`);
      if (!el) return;
      if (key === 'image') {
        el.src = value;
      } else {
        el.textContent = value;
      }
    });
    newCard.href = `/articles/${card.id}`;
    newCard.dataset.id = card.id;
    return newCard;
  };

  // Adds a batch of cards to the end of the grid, skipping articles that are already on the page
  // (one can move into a later batch when new articles are published while the reader scrolls)
  const renderCards = (cards = []) => {
    let addedCards = 0;
    cards.forEach(item => {
      if (seen.has(item.id)) return;
      grid.append(buildCard(item));
      seen.add(item.id);
      addedCards += 1;
    });

    // "עוד בחדשות" only makes sense under the lead and side cards, which a filter change hides
    if (addedCards > 0 && topStories && !topStories.hidden) {
      document.querySelector('.section-title').hidden = false;
    }
  };

  // Shows the batch that was fetched ahead, then starts fetching the one after it.
  // Called when the sentinel gets near the screen, after a filter change, and by the retry button.
  const loadMore = async () => {
    if (loading || !hasMore) return;

    loading = true;
    const currGen = generation; // which filter this batch belongs to
    try {
      const { data, meta } = await nextBatch;
      if (generation !== currGen) return; // the filter changed while this batch was loading

      renderCards(data);
      nextSkip += LIMIT; // the API skips by position, not by the cards we actually added
      hasMore = meta.hasMore;

      // Nothing more to load: show "no articles" or "you saw everything", and stop watching the sentinel
      if (!hasMore) {
        if (seen.size === 0) {
          document.querySelector('.feed-empty').hidden = false;
        } else {
          document.querySelector('.feed-end').hidden = false;
        }
        observer.disconnect();
        return;
      }

      nextBatch = fetchBatch(nextSkip);
      // The observer only reports changes. If the sentinel is still near the screen after adding the cards
      // (short batch, tall screen) there is no change, so watch it again to get a fresh report:
      observer.unobserve(sentinel);
      observer.observe(sentinel); // observe() always reports the current state once, so it loads again if still close
    } catch (error) {
      if (generation !== currGen) return; // an error from an old filter's batch
      console.error('feed batch failed:', error);
      document.querySelector('.feed-error').hidden = false;
    } finally {
      // An old batch finishing late must not unlock the batch of the new filter
      if (currGen === generation) loading = false;
    }
  };

  // IntersectionObserver callback; entries[0] is the sentinel (the only element it watches).
  // isIntersecting is false when it moves away from the screen, then there is nothing to do.
  const onNear = (entries) => {
    if (!entries[0].isIntersecting) return;
    loadMore();
  };

  // "נסה שוב" after a failed batch: the failed promise can't be awaited again, so fetch the same batch anew
  const onRetryClick = () => {
    document.querySelector('.feed-error').hidden = true;
    nextBatch = fetchBatch(nextSkip);
    loadMore();
  };

  // Empties the feed before loading the first batch of a new filter.
  // Back on the plain home page the lead + side cards come back, and the grid continues after them.
  const resetFeed = ({ frontPage }) => {
    grid.replaceChildren(); // removes all the cards
    generation += 1; // any batch still loading now belongs to the old filter and will be ignored
    seen.clear();
    loading = false;
    hasMore = true; // unknown yet, the first batch of the new filter will tell

    if (frontPage) {
      topStories.hidden = false;
      topStoryIds.forEach(id => seen.add(id));
      nextSkip = topStoryIds.length; // they are the first articles of the date sort
    } else {
      if (topStories) topStories.hidden = true;
      nextSkip = 0;
    }

    document.querySelector('.section-title').hidden = true;
    document.querySelector('.feed-end').hidden = true;
    document.querySelector('.feed-error').hidden = true;
    document.querySelector('.feed-empty').hidden = true;
    observer.observe(sentinel); // it may have been disconnected when the old filter reached its end
  };

  // Shows the feed for new filters: updates the URL, empties the feed and loads the first batch.
  // mode: 'push' adds a history entry, 'replace' updates the current one, 'none' leaves it (back button)
  const applyFilters = (params, { history: mode = 'push' } = {}) => {
    // The URL is the source of truth for the filters (fetchBatch and the controls read it),
    // so it is changed first. Changing it with history doesn't reload the page.
    const url = params.toString() ? '/?' + params : '/';
    if (mode !== 'none') {
      if (url === location.pathname + location.search) return; // same filter: do nothing at all
      if (mode === 'push') {
        history.pushState(null, '', url);
      } else {
        history.replaceState(null, '', url);
      }
    }

    // Back to the plain home page, but it was loaded with a filter so there are no lead + side cards
    // to show: let the server render the page (rare: only after clearing every filter)
    const frontPage = !isFiltered(params);
    if (frontPage && !topStories) {
      location.reload();
      return;
    }

    resetFeed({ frontPage });
    // Bring the results into view if the reader had scrolled past the filters (the back button scrolls by itself)
    if (mode !== 'none') {
      const filters = document.querySelector('.filters');
      if (filters.getBoundingClientRect().top < 0) {
        filters.scrollIntoView({ behavior: 'smooth' });
      }
    }
    syncControls(params);
    nextBatch = fetchBatch(nextSkip);
    loadMore();
  };

  // Makes the controls match the current filters (they were rendered by the server for the old ones)
  const syncControls = (params) => {
    const q = params.get('q') || '';
    const category = params.get('category') || '';
    const sort = params.get('sort') || 'date';
    const view = params.get('view') || 'all';

    document.querySelector('.filters__count').hidden = !q;
    document.querySelector('.search-term').textContent = q;
    searchInput.value = q;
    categorySelect.value = category;

    document.querySelectorAll('[data-view]').forEach(pill => {
      pill.classList.toggle('is-active', pill.dataset.view === view);
    });
    document.querySelectorAll('[data-sort]').forEach(pill => {
      pill.classList.toggle('is-active', pill.dataset.sort === sort);
    });
    document.querySelectorAll('[data-category]').forEach(link => {
      link.classList.toggle('is-active', link.dataset.category === category);
    });
  };

  // Starts loading while the sentinel is still two screen-heights below the viewport
  // (rootMargin grows the screen area by 200% at the bottom only)
  const observer = new IntersectionObserver(onNear, { rootMargin: '0px 0px 200% 0px' });
  observer.observe(sentinel);

  document.querySelector('.retry-button').addEventListener('click', onRetryClick);

  const categorySelect = document.getElementById('category-select');
  const categoryForm = categorySelect.closest('form');
  const searchForm = document.querySelector('form.search');
  const searchInput = searchForm.querySelector('input[name="q"]');

  // Each control changes only its own filter and keeps the rest from the current URL
  // (the hrefs and hidden fields the server rendered go stale after an Ajax change).

  // The category <select> changed (or its form was sent)
  const onCategoryChange = () => {
    const params = new URLSearchParams(location.search);
    if (categorySelect.value) {
      params.set('category', categorySelect.value);
    } else {
      params.delete('category'); // "הכל": no category at all, not "category="
    }
    applyFilters(params);
  };

  // The search form was sent
  const onSearchSubmit = () => {
    const params = new URLSearchParams(location.search);
    const q = searchInput.value.trim();
    if (q === '') {
      params.delete('q'); // an empty box clears the search but keeps the category and sort
    } else {
      params.set('q', q);
    }
    applyFilters(params);
  };

  // Takes over the filter links and forms: instead of loading a new page they change the feed with Ajax.
  // preventDefault() stops the normal navigation; without JS the links and forms still work as usual.
  const connectControls = () => {
    // the sort pills (תאריך / פופולריות)
    document.querySelectorAll('[data-sort]').forEach(pill => {
      pill.addEventListener('click', (event) => {
        event.preventDefault();
        const params = new URLSearchParams(location.search);
        params.set('sort', pill.dataset.sort);
        applyFilters(params);
      });
    });

    // the view pills (הכל / לא נצפו)
    document.querySelectorAll('[data-view]').forEach(pill => {
      pill.addEventListener('click', (event) => {
        event.preventDefault();
        const params = new URLSearchParams(location.search);
        if (pill.dataset.view === 'unseen') {
          params.set('view', 'unseen');
        } else {
          params.delete('view'); // "הכל"
        }
        applyFilters(params);
      });
    });

    // the category links (in views/partials/header.ejs)
    document.querySelectorAll('[data-category]').forEach(link => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const params = new URLSearchParams(location.search);
        if (link.dataset.category === '') {
          params.delete('category'); // "הכל"
        } else {
          params.set('category', link.dataset.category);
        }
        applyFilters(params);
      });
    });

    categorySelect.addEventListener('change', onCategoryChange);
    categoryForm.addEventListener('submit', (event) => {
      event.preventDefault();
      onCategoryChange();
    });

    // One submit listener covers both the search button and Enter in the box
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      onSearchSubmit();
    });
  };

  connectControls();
  // The "הכל / לא נצפו" pills are hidden in the HTML because they only work with JS (localStorage)
  document.querySelector('[data-view-filter]')?.removeAttribute('hidden');

  // Back / forward buttons: the URL already changed to an earlier filter, show that filter's feed.
  // history 'none' because the browser already moved in the history, adding an entry would break it.
  window.addEventListener('popstate', () => applyFilters(new URLSearchParams(location.search), { history: 'none' }));

  // The "unseen" view arrives from the server with an empty grid (it can't read localStorage).
  // Show the first batch right away instead of waiting for the observer: after F5 the browser
  // may restore a scroll position that leaves the sentinel above the screen, where it never fires.
  if (hasMore && nextSkip === 0) loadMore();

  // Back from an article: the browser may restore this page from memory (the back/forward cache)
  // exactly as it was, without running anything again. In the "unseen" view, take out what was just read.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return; // a normal page load is already up to date
    if (new URLSearchParams(location.search).get('view') !== 'unseen') return;

    const readIds = new Set(getReadIds());
    let removed = 0;
    grid.querySelectorAll('[data-id]').forEach(card => {
      if (!readIds.has(card.dataset.id)) return;
      card.remove();
      seen.delete(card.dataset.id);
      removed += 1;
    });
    if (!removed) return;

    nextSkip -= removed; // the server's "unseen" list is now shorter by the same number, before this point
    if (hasMore) nextBatch = fetchBatch(nextSkip); // the waiting batch was fetched with the old list
  });
})();
