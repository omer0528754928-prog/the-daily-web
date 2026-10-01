(() => {
  const LIMIT = 20;
  const sentinel = document.querySelector('.refresh-sentinel');
  const template = document.getElementById('grid-card-template');
  const grid = document.getElementById('feed-grid');

  if (!sentinel || !grid || !template) return;

  let hasMore = sentinel.dataset.hasMore === 'true';
  let nextSkip = Number(sentinel.dataset.nextSkip);
  let loading = false;
  const cardTemplate = template.content.firstElementChild;

  // Ids of the cards already on the page, so a batch never adds the same article twice
  const seen = new Set([...document.querySelectorAll('.feed [data-id]')].map(card => card.dataset.id));

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

  // Clones the empty card from the template and fills it (textContent, so titles can't inject HTML)
  const buildCard = (card) => {
    const newCard = cardTemplate.cloneNode(true);
    Object.entries(card).forEach(([key, value]) => {
      const el = newCard.querySelector(`[data-field="${key}"]`);
      if (!el) return;
      el.textContent = value;
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

    if (addedCards > 0) {
      document.querySelector('.section-title').hidden = false;
    }
  };

  const loadMore = async () => {
    if (loading || !hasMore) return;

    loading = true;
    try {
      const { data, meta } = await nextBatch;

      renderCards(data);
      nextSkip += LIMIT;
      hasMore = meta.hasMore;

      if (!hasMore) {
        document.querySelector('.feed-end').hidden = false;
        observer.disconnect();
        return;
      }

      nextBatch = fetchBatch(nextSkip);
      observer.unobserve(sentinel);
      observer.observe(sentinel); // observe() always reports the current state once, so it loads again if still close
    } catch (error) {
      console.error('feed batch failed:', error)
      document.querySelector('.feed-error').hidden = false;
    } finally {
      loading = false;
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

  // Starts loading while the sentinel is still two screen-heights below the viewport
  const observer = new IntersectionObserver(onNear, { rootMargin: '0px 0px 200% 0px' });
  observer.observe(sentinel);

  document.querySelector('.retry-button').addEventListener('click',onRetryClick);
})();
