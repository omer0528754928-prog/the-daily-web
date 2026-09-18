const CATEGORIES = require('../config/categories');
const { STATUS, STATUS_LABELS } = require('../config/articleStatus');

// Everything the filter panels in views/reporter.ejs need: the options with their
// state, and the hidden fields that carry the other columns' filters along.

function toOptions(values, chosen, labelOf = value => value) {
  return values.map(value => ({ value, label: labelOf(value), checked: chosen.includes(value) }));
}

// The other columns' filters travel as hidden inputs, so opening one panel
// does not drop what another column is filtering by
function hiddenFields(filters, except) {
  const fields = [];
  const add = (name, value) => fields.push({ name, value });

  if (except !== 'category') filters.category.forEach(value => add('category', value));
  if (except !== 'status') filters.status.forEach(value => add('status', value));
  if (except !== 'returned' && filters.returned) add('returned', filters.returned);
  if (except !== 'published') {
    if (filters.publishedFrom) add('publishedFrom', toDateInput(filters.publishedFrom));
    if (filters.publishedTo) add('publishedTo', toDateInput(filters.publishedTo));
  }
  return fields;
}

// Date inputs use YYYY-MM-DD
function toDateInput(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : '';
}

function toFilterPanels(filters) {
  return {
    category: {
      active: filters.category.length > 0,
      options: toOptions(CATEGORIES, filters.category),
      hidden: hiddenFields(filters, 'category'),
    },
    status: {
      active: filters.status.length > 0,
      options: toOptions(Object.values(STATUS), filters.status, value => STATUS_LABELS[value]),
      hidden: hiddenFields(filters, 'status'),
    },
    returned: {
      active: Boolean(filters.returned),
      options: [
        { value: 'yes', label: 'כן', checked: filters.returned === 'yes' },
        { value: 'no', label: 'לא', checked: filters.returned === 'no' },
      ],
      hidden: hiddenFields(filters, 'returned'),
    },
    published: {
      active: Boolean(filters.publishedFrom || filters.publishedTo),
      from: toDateInput(filters.publishedFrom),
      to: toDateInput(filters.publishedTo),
      hidden: hiddenFields(filters, 'published'),
    },
    anyActive: Boolean(
      filters.category.length || filters.status.length || filters.returned || filters.publishedFrom || filters.publishedTo,
    ),
  };
}

// Builds "/reporter?..." keeping the current filters and changing only the page
function toUrl(filters, page) {
  const params = new URLSearchParams();
  for (const { name, value } of hiddenFields(filters, null)) params.append(name, value);
  if (page > 1) params.set('page', page);
  const query = params.toString();
  return query ? `/reporter?${query}` : '/reporter';
}

// The numbers under the table: first three and last three pages, the current page,
// and a gap (…) wherever numbers were skipped
function toPageItems(filters, current, pages) {
  // Few enough pages: list them all
  const wanted = pages <= 7
    ? Array.from({ length: pages }, (_, index) => index + 1)
    : [1, 2, 3, pages - 2, pages - 1, pages, current];
  const shown = new Set(wanted.filter(number => number >= 1 && number <= pages));

  const items = [];
  let previous = 0;
  for (const number of [...shown].sort((a, b) => a - b)) {
    if (previous && number - previous > 1) items.push({ type: 'gap' });
    items.push({ type: 'page', number, url: toUrl(filters, number), current: number === current });
    previous = number;
  }
  return items;
}

function toPager(filters, { page, pageSize, total }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);

  return {
    page: current,
    pages,
    total,
    shown: Math.max(0, Math.min(current * pageSize, total) - (current - 1) * pageSize),
    items: toPageItems(filters, current, pages),
    prevUrl: current > 1 ? toUrl(filters, current - 1) : null,
    nextUrl: current < pages ? toUrl(filters, current + 1) : null,
  };
}

module.exports = { toFilterPanels, toPager, clearFiltersUrl: () => '/reporter' };
