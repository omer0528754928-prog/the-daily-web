'use strict';

/* ==========================================================================
   The Daily Web — Editor area, client side (Member 5)
   Talks to the server with Ajax (fetch). Nothing here is security: every
   action is re-checked on the server. This only builds the screen and calls
   the API without ever reloading the page.
   ========================================================================== */

(function () {
  const API = '/editor/api';
  const STATUS_LABELS = {
    draft: 'בהכנה',
    pending: 'ממתינה לאישור',
    published: 'פורסמה',
    returned: 'הוחזרה לתיקונים',
  };

  let currentStatus = 'all';
  let selectedId = null;
  let cache = new Map(); // id -> full article (last fetched)

  const $ = (sel, root = document) => root.querySelector(sel);
  const listEl = $('#list');
  const emptyEl = $('#list-empty');
  const detailEl = $('#detail');
  const toastEl = $('#toast');

  // ---- helpers -------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return '—'; }
  }
  function badge(status) {
    return `<span class="badge ${status}">${esc(STATUS_LABELS[status] || status)}</span>`;
  }
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + (kind || '');
    setTimeout(() => toastEl.classList.add('hidden'), 3000);
  }

  async function api(path, opts = {}) {
    const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + path, { credentials: 'same-origin', headers, ...opts });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || `שגיאה (${res.status})`);
    return data;
  }

  // ---- filter tabs ---------------------------------------------------------
  function initFilters() {
    // fill Hebrew labels the EJS left as raw keys
    document.querySelectorAll('[data-status-label]').forEach((el) => {
      const s = el.getAttribute('data-status-label');
      el.textContent = STATUS_LABELS[s] || s;
    });
    document.querySelectorAll('.filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        currentStatus = btn.getAttribute('data-status');
        loadList();
      });
    });
  }
  function setCounts(counts) {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const key = el.getAttribute('data-count');
      el.textContent = counts && counts[key] != null ? counts[key] : 0;
    });
  }

  // ---- list ----------------------------------------------------------------
  async function loadList() {
    try {
      const q = currentStatus === 'all' ? '' : `?status=${encodeURIComponent(currentStatus)}`;
      const data = await api(`/articles${q}`);
      setCounts(data.counts);
      renderList(data.articles);
    } catch (err) {
      listEl.innerHTML = '';
      toast(err.message, 'error');
    }
  }

  function renderList(articles) {
    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', articles.length > 0);
    for (const a of articles) {
      const el = document.createElement('article');
      el.className = 'card' + (a._id === selectedId ? ' is-selected' : '');
      el.dataset.id = a._id;
      const pendingFlag = a.hasPendingUpdate
        ? ' <span class="badge pending-update">עדכון ממתין</span>' : '';
      el.innerHTML = `
        <h3>${esc(a.title)}</h3>
        <div class="card-meta">
          ${badge(a.status)}${pendingFlag}
          <span>${esc(a.category)}</span>
          <span>${esc(a.author || '')}</span>
          <span>עודכן: ${fmtDate(a.updatedAt)}</span>
        </div>`;
      el.addEventListener('click', () => selectArticle(a._id));
      listEl.appendChild(el);
    }
  }

  // ---- detail --------------------------------------------------------------
  async function selectArticle(id) {
    selectedId = id;
    document.querySelectorAll('.card').forEach((c) =>
      c.classList.toggle('is-selected', c.dataset.id === id));
    try {
      const data = await api(`/articles/${id}`);
      cache.set(id, data.article);
      renderDetail(data.article);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function actionsFor(a) {
    const isPending = a.status === 'pending';
    const isPublishedUpdate = a.status === 'published' && a.hasPendingUpdate;
    const canWork = isPending || isPublishedUpdate;
    const btns = [];
    if (canWork) {
      btns.push(`<button class="btn btn-approve" data-act="approve">אשר ופרסם</button>`);
      btns.push(`<button class="btn btn-return" data-act="return">החזר לתיקונים</button>`);
      btns.push(`<button class="btn" data-act="edit">ערוך תוכן</button>`);
    }
    btns.push(`<button class="btn btn-danger" data-act="delete">מחק</button>`);
    return `<div class="actions">${btns.join('')}</div>`;
  }

  function renderDetail(a) {
    const isPublished = a.status === 'published';
    const isPublishedUpdate = isPublished && a.hasPendingUpdate;
    const p = a.pending || {};
    const parts = [];

    // editor note — shown whenever one exists (the "fixes" context)
    if (a.editorNote) {
      parts.push(`<div class="note-box"><strong>הערת עורך לתיקונים:</strong> ${esc(a.editorNote)}</div>`);
    }

    if (isPublishedUpdate) {
      // published article + a pending (fixed/updated) version → show both side by side
      parts.push(`<p class="hint">כתבה מפורסמת שיש לה גרסת עדכון הממתינה לאישורך. הקוראים רואים את הגרסה מימין; אישור יהפוך את גרסת העדכון לגרסה הציבורית.</p>`);
      parts.push(`
        <div class="compare">
          <div class="live"><h4>מפורסם כרגע (הקוראים רואים)</h4>
            <strong>${esc(a.title)}</strong>
            <div class="detail-body">${esc(a.content)}</div></div>
          <div class="new"><h4>גרסה עדכנית (לאחר תיקונים / ממתינה לאישור)</h4>
            <strong>${esc(p.title || '')}</strong>
            <div class="detail-body">${esc(p.content || '')}</div></div>
        </div>`);
    } else if (isPublished) {
      parts.push(`<div><h4>מפורסם כרגע (הקוראים רואים)</h4>
        <div class="detail-body">${esc(a.content)}</div></div>`);
    } else {
      // draft / pending / returned — a single submitted version exists
      const label = a.status === 'returned' ? 'הגרסה הנוכחית של הכתב (הוחזרה לתיקונים)'
        : a.status === 'pending' ? 'התוכן שהוגש לאישור'
        : 'טיוטה';
      parts.push(`<div><h4>${label}</h4>
        <div class="detail-body">${esc(a.content)}</div></div>`);
    }

    detailEl.innerHTML = `
      <div class="detail">
        <h2>${esc(a.title)}</h2>
        <div class="detail-meta">
          ${badge(a.status)}
          ${a.hasPendingUpdate ? '<span class="badge pending-update">עדכון ממתין</span>' : ''}
          <span>קטגוריה: ${esc(a.category)}</span>
          <span>כתב: ${esc(a.author || '—')}</span>
          <span>פורסמה: ${fmtDate(a.publishedAt)}</span>
        </div>
        ${parts.join('')}
        ${actionsFor(a)}
        <div id="action-area"></div>
      </div>`;

    detailEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => onAction(btn.getAttribute('data-act'), a));
    });
  }

  // ---- actions -------------------------------------------------------------
  function onAction(act, a) {
    const area = $('#action-area');
    area.innerHTML = '';
    if (act === 'approve') return doApprove(a._id);
    if (act === 'return') return showReturnForm(a, area);
    if (act === 'edit') return showEditForm(a, area);
    if (act === 'delete') return showDeleteConfirm(a, area);
  }

  async function doApprove(id) {
    try {
      await api(`/articles/${id}/approve`, { method: 'POST' });
      toast('הכתבה אושרה ופורסמה ✓', 'ok');
      await refreshAfterAction(id);
    } catch (err) { toast(err.message, 'error'); }
  }

  function showReturnForm(a, area) {
    area.innerHTML = `
      <div class="edit-form">
        <label>הערה לכתב (חובה):</label>
        <textarea id="return-note" placeholder="מה צריך לתקן?"></textarea>
        <div class="actions">
          <button class="btn btn-return" id="return-submit">שלח החזרה</button>
        </div>
      </div>`;
    $('#return-submit').addEventListener('click', async () => {
      const note = $('#return-note').value.trim();
      if (!note) return toast('חובה לכתוב הערה', 'error');
      try {
        await api(`/articles/${a._id}/return`, { method: 'POST', body: JSON.stringify({ note }) });
        toast('הכתבה הוחזרה לכתב עם הערה ✓', 'ok');
        await refreshAfterAction(a._id);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function showEditForm(a, area) {
    const src = (a.status === 'published' && a.hasPendingUpdate) ? (a.pending || {}) : a;
    area.innerHTML = `
      <div class="edit-form">
        <label>כותרת:</label>
        <input id="e-title" value="${esc(src.title || '')}" />
        <label>תקציר:</label>
        <input id="e-summary" value="${esc(src.summary || '')}" />
        <label>תוכן:</label>
        <textarea id="e-content">${esc(src.content || '')}</textarea>
        <div class="actions">
          <button class="btn btn-primary" id="edit-save">שמור שינויים</button>
        </div>
      </div>`;
    $('#edit-save').addEventListener('click', async () => {
      const body = {
        title: $('#e-title').value.trim(),
        summary: $('#e-summary').value.trim(),
        content: $('#e-content').value.trim(),
      };
      if (!body.title || !body.content) return toast('כותרת ותוכן הם חובה', 'error');
      try {
        await api(`/articles/${a._id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast('השינויים נשמרו ✓', 'ok');
        await refreshAfterAction(a._id);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function showDeleteConfirm(a, area) {
    area.innerHTML = `
      <div class="note-box">
        למחוק את הכתבה "<strong>${esc(a.title)}</strong>"? פעולה זו אינה הפיכה.
        <div class="actions">
          <button class="btn btn-danger" id="del-yes">כן, מחק</button>
          <button class="btn btn-ghost" id="del-no">ביטול</button>
        </div>
      </div>`;
    $('#del-no').addEventListener('click', () => (area.innerHTML = ''));
    $('#del-yes').addEventListener('click', async () => {
      try {
        await api(`/articles/${a._id}`, { method: 'DELETE' });
        toast('הכתבה נמחקה ✓', 'ok');
        selectedId = null;
        detailEl.innerHTML = '<p class="detail-placeholder">בחר כתבה מהרשימה כדי לצפות בה ולבצע פעולות.</p>';
        await loadList();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function refreshAfterAction(id) {
    await loadList();
    // re-open the (possibly changed) article if it still exists
    try {
      const data = await api(`/articles/${id}`);
      cache.set(id, data.article);
      renderDetail(data.article);
    } catch {
      detailEl.innerHTML = '<p class="detail-placeholder">בחר כתבה מהרשימה כדי לצפות בה ולבצע פעולות.</p>';
    }
  }

  // ---- boot ----------------------------------------------------------------
  initFilters();
  loadList();
})();
