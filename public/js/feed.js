(() => {
  const LIMIT = 20;
  const sentinel = document.querySelector('.refresh-sentinel');
  const template = document.getElementById('grid-card-template');
  const grid = document.getElementById('feed-grid');
  // The lead + side cards. The server renders them only on the plain home page (no filters)
  const topStories = document.querySelector('.top-stories');

  if (!sentinel || !grid || !template) return;

  let hasMore = sentinel.dataset.hasMore === 'true';
  let nextSkip = Number(sentinel.dataset.nextSkip);
  let loading = false;
  // Goes up on every filter change, so responses for an old filter can be ignored
  let generation = 0;
  const cardTemplate = template.content.firstElementChild;

  // Ids of the cards already on the page, so a batch never adds the same article twice
  const seen = new Set([...document.querySelectorAll('.feed [data-id]')].map(card => card.dataset.id));
  const topStoryIds = topStories ? [...topStories.querySelectorAll('[data-id]')].map(card => card.dataset.id) : [];

  // Same rule as isFiltered in views/home.ejs: any category, search or sort means a plain grid
  const isFiltered = (params) => ['category', 'q', 'sort'].some(key => params.get(key));

  // One batch of cards from the API, with the same filters as the current page
  const fetchBatch = async (skip = 0) => {
    const params = new URLSearchParams(location.search);
    params.set('skip', skip);
    params.set('limit', LIMIT);

    const response = await fetch('/api/feed?' + params);
    if (!response.ok) throw new Error('cant fetch new data');
    return response.json();
  };

  // The next batch is fetched ahead of time, so it's ready before the reader reaches the bottom
  let nextBatch = hasMore ? fetchBatch(nextSkip) : null;

  // Clones the empty card from the template and fills it (textContent, so titles can't inject HTML;
  // the image is the one field that goes into an attribute instead)
  const buildCard = (card) => {
    const newCard = cardTemplate.cloneNode(true);
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

  const loadMore = async () => {
    if (loading || !hasMore) return;

    loading = true;
    const currGen = generation;
    try {
      const { data, meta } = await nextBatch;
      if (generation !== currGen) return; // the filter changed while this batch was loading

      renderCards(data);
      nextSkip += LIMIT;
      hasMore = meta.hasMore;

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

  const onNear = (entries) => {
    if (!entries[0].isIntersecting) return;
    loadMore();
  };

  const onRetryClick = () => {
    document.querySelector('.feed-error').hidden = true;
    nextBatch = fetchBatch(nextSkip);
    loadMore();
  };

  // Empties the feed before loading the first batch of a new filter.
  // Back on the plain home page the lead + side cards come back, and the grid continues after them.
  const resetFeed = ({ frontPage }) => {
    grid.replaceChildren();
    generation += 1;
    seen.clear();
    loading = false;
    hasMore = true;

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
    observer.observe(sentinel);
  };

  // mode: 'push' adds a history entry, 'replace' updates the current one, 'none' leaves it (back button)
  const applyFilters = (params, { history: mode = 'push' } = {}) => {
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

    document.querySelector('.filters__count').hidden = !q;
    document.querySelector('.search-term').textContent = q;
    searchInput.value = q;
    categorySelect.value = category;

    document.querySelectorAll('[data-sort]').forEach(pill => {
      pill.classList.toggle('is-active', pill.dataset.sort === sort);
    });
    document.querySelectorAll('[data-category]').forEach(link => {
      link.classList.toggle('is-active', link.dataset.category === category);
    });
  };

  // Starts loading while the sentinel is still two screen-heights below the viewport
  const observer = new IntersectionObserver(onNear, { rootMargin: '0px 0px 200% 0px' });
  observer.observe(sentinel);

  document.querySelector('.retry-button').addEventListener('click', onRetryClick);

  const categorySelect = document.getElementById('category-select');
  const categoryForm = categorySelect.closest('form');
  const searchForm = document.querySelector('form.search');
  const searchInput = searchForm.querySelector('input[name="q"]');

  // Each control changes only its own filter and keeps the rest from the current URL
  // (the hrefs and hidden fields the server rendered go stale after an Ajax change)
  const onCategoryChange = () => {
    const params = new URLSearchParams(location.search);
    if (categorySelect.value) {
      params.set('category', categorySelect.value);
    } else {
      params.delete('category'); // "הכל": no category at all, not "category="
    }
    applyFilters(params);
  };

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

  const connectControls = () => {
    document.querySelectorAll('[data-sort]').forEach(pill => {
      pill.addEventListener('click', (event) => {
        event.preventDefault();
        const params = new URLSearchParams(location.search);
        params.set('sort', pill.dataset.sort);
        applyFilters(params);
      });
    });

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

  window.addEventListener('popstate', () => applyFilters(new URLSearchParams(location.search), { history: 'none' }));
})();
