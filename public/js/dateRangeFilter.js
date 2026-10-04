// The "פורסם" filter in the reporter table: when the "to" date is before the "from" date,
// the filter is not sent and the problem is written inside the panel.
(function () {
  const form = document.querySelector('form[data-date-range]');
  if (!form) return;

  const from = form.elements.publishedFrom;
  const to = form.elements.publishedTo;
  const problem = form.querySelector('[data-range-problem]');

  // Date inputs hold YYYY-MM-DD, so comparing the text compares the dates
  function isBackwards() {
    return Boolean(from.value && to.value && to.value < from.value);
  }

  for (const input of [from, to]) {
    input.addEventListener('input', () => { problem.hidden = !isBackwards(); });
  }

  form.addEventListener('submit', event => {
    if (!isBackwards()) return;
    event.preventDefault();
    problem.hidden = false;
  });
})();
