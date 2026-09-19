'use strict';

/* ==========================================================================
   The Daily Web — Impact Analytics, client side (Member 5)
   Fetches server-computed data via Ajax and draws it. Charts use Chart.js;
   the status flow and the table are plain HTML/CSS. Live users update by
   polling a heartbeat endpoint. Nothing here is security — the server guards
   every data endpoint and computes every number.
   ========================================================================== */

(function () {
  const API = '/editor/analytics/api';
  const PING_URL = '/editor/analytics/ping';
  const STATUS_LABELS = { draft: 'בהכנה', pending: 'ממתינה לאישור', published: 'פורסמה', returned: 'הוחזרה לתיקונים' };
  const PALETTE = ['#b91c1c', '#1d4ed8', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#4b5563', '#ca8a04'];

  const $ = (s) => document.querySelector(s);
  const toastEl = $('#toast');
  let monthChart, categoryChart, articleChart;
  let categoriesLoaded = false;

  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + (kind || '');
    setTimeout(() => toastEl.classList.add('hidden'), 3000);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  async function api(path) {
    const res = await fetch(API + path, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    });
    let data = null; try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error((data && data.error) || `שגיאה (${res.status})`);
    return data;
  }

  function currentFilters() {
    const p = new URLSearchParams();
    const c = $('#filterCategory').value;
    const f = $('#filterFrom').value;
    const t = $('#filterTo').value;
    if (c) p.set('category', c);
    if (f) p.set('from', f);
    if (t) p.set('to', t);
    const s = p.toString();
    return s ? '?' + s : '';
  }

  // ---- render helpers ------------------------------------------------------
  function fillCategories(cats) {
    if (categoriesLoaded) return;
    const sel = $('#filterCategory');
    cats.forEach((c) => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c; sel.appendChild(o);
    });
    categoriesLoaded = true;
  }

  function renderTiles(d) {
    $('#statArticles').textContent = d.totalArticles.toLocaleString('he-IL');
    $('#statViews').textContent = d.totalViews.toLocaleString('he-IL');
  }

  function renderMonth(byMonth) {
    const ctx = $('#chartMonth');
    monthChart && monthChart.destroy();
    monthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: byMonth.map((x) => x.ym),
        datasets: [{
          label: 'כתבות שפורסמו', data: byMonth.map((x) => x.count),
          borderColor: PALETTE[1], backgroundColor: 'rgba(29,78,216,.12)',
          fill: true, tension: .3, pointRadius: 3,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }

  function renderCategory(byCategory) {
    const ctx = $('#chartCategory');
    categoryChart && categoryChart.destroy();
    categoryChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: byCategory.map((x) => x.category),
        datasets: [{ data: byCategory.map((x) => x.count), backgroundColor: byCategory.map((_, i) => PALETTE[i % PALETTE.length]) }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'left' } } },
    });
  }

  function renderStatusFlow(byStatus) {
    const node = (key) => `
      <div class="flow-node ${key}">
        <div class="n">${(byStatus[key] || 0).toLocaleString('he-IL')}</div>
        <div class="t">${STATUS_LABELS[key]}</div>
      </div>`;
    const arrow = '<div class="flow-arrow">←</div>';
    $('#statusFlow').innerHTML =
      node('draft') + arrow + node('pending') + arrow + node('published') +
      '<div class="flow-branch"></div>' +
      '<div class="flow-arrow">↳ הוחזרה לתיקונים:</div>' + node('returned');
  }

  function renderTable(perArticle) {
    const rows = perArticle.map((a) => `
      <tr>
        <td>${esc(a.legacyId ?? '')}</td>
        <td>${esc(a.title)}</td>
        <td>${esc(a.category)}</td>
        <td class="num">${(a.views || 0).toLocaleString('he-IL')}</td>
      </tr>`).join('');
    $('#viewsTableBody').innerHTML = rows || '<tr><td colspan="4">אין נתוני צפייה לסינון זה.</td></tr>';
  }

  // ---- load dashboard ------------------------------------------------------
  async function loadOverview() {
    try {
      const d = await api('/overview' + currentFilters());
      fillCategories(d.allCategories || []);
      renderTiles(d);
      renderMonth(d.byMonth || []);
      renderCategory(d.byCategory || []);
      renderStatusFlow(d.byStatus || {});
      renderTable(d.perArticle || []);
    } catch (err) { toast(err.message, 'error'); }
  }

  // ---- per-article chart (Phase 7) -----------------------------------------
  async function loadArticlePicker() {
    try {
      const { articles } = await api('/articles');
      const sel = $('#articleSelect');
      articles.forEach((a) => {
        const o = document.createElement('option');
        o.value = a.articleId;
        o.textContent = `#${a.legacyId ?? ''} — ${a.title} (${a.views})`;
        sel.appendChild(o);
      });
    } catch (err) { toast(err.message, 'error'); }
  }

  async function loadArticleSeries(articleId) {
    try {
      const { article, series } = await api('/article-series?articleId=' + encodeURIComponent(articleId));
      const labels = series.map((p) => new Date(p.day).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }));
      const counts = series.map((p) => p.count);
      const pubIdx = series.map((p, i) => (p.isUpdatePublishPoint ? i : -1)).filter((i) => i >= 0);
      const ctx = $('#chartArticle');
      articleChart && articleChart.destroy();
      articleChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: `צפיות: ${article.title}`,
            data: counts,
            borderColor: PALETTE[2],
            backgroundColor: 'rgba(22,163,74,.12)',
            fill: true, tension: .3,
            pointRadius: counts.map((_, i) => (pubIdx.includes(i) ? 7 : 2)),
            pointBackgroundColor: counts.map((_, i) => (pubIdx.includes(i) ? PALETTE[0] : PALETTE[2])),
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true },
            tooltip: { callbacks: { afterLabel: (c) => (pubIdx.includes(c.dataIndex) ? '★ פורסם עדכון ביום זה' : '') } },
          },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });
    } catch (err) { toast(err.message, 'error'); }
  }

  // ---- live users ----------------------------------------------------------
  async function pingLive() {
    try {
      const res = await fetch(PING_URL, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const d = await res.json();
      $('#liveUsers').textContent = (d.live || 0).toLocaleString('he-IL');
    } catch { /* ignore transient errors */ }
  }

  // ---- wire up -------------------------------------------------------------
  $('#applyBtn').addEventListener('click', loadOverview);
  $('#resetBtn').addEventListener('click', () => {
    $('#filterCategory').value = ''; $('#filterFrom').value = ''; $('#filterTo').value = '';
    loadOverview();
  });
  $('#articleSelect').addEventListener('change', (e) => { if (e.target.value) loadArticleSeries(e.target.value); });

  // boot
  loadOverview();
  loadArticlePicker();
  pingLive();
  setInterval(pingLive, 15000); // heartbeat every 15s
})();
