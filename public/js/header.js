// Mobile header (every page): the top bar's links open from a menu button, and the search box
// opens from the search button. The CSS collapses them only on narrow screens and only after this
// script adds .is-collapsible, so without JS (or on a wide screen) everything stays visible as before.
(() => {
  const topbar = document.querySelector('.topbar');
  const toggle = topbar?.querySelector('.topbar__toggle');
  if (toggle) {
    topbar.classList.add('is-collapsible');
    toggle.addEventListener('click', () => {
      const open = topbar.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open);
    });
  }

  const search = document.querySelector('form.search');
  if (search) {
    const input = search.querySelector('input[name="q"]');
    search.classList.add('is-collapsible');
    if (input.value) search.classList.add('is-open'); // an active search stays visible

    // While the box is hidden (mobile only) the first press opens it; once it's open, the button searches
    search.querySelector('button').addEventListener('click', (event) => {
      if (getComputedStyle(input).display !== 'none') return;
      event.preventDefault();
      search.classList.add('is-open');
      input.focus();
    });
  }
})();
