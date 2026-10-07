// Impact Analytics: submit the article filter as soon as the editor picks a
// different article. The page still works without this (there is a submit button).
(function () {
  const form = document.querySelector('[data-stats-filter]');
  const select = form && form.querySelector('[data-stats-select]');
  if (!select) return;
  select.addEventListener('change', () => form.submit());
})();
