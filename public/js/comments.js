// Sends the comment form without reloading the page, and loads older comments on demand.
// Without JavaScript the same form still works: it posts to /articles/:id/comments and the
// server redirects back to the article, so this file only improves the page.
(function () {
  const section = document.querySelector('.comments[data-article-id]');
  if (!section) return;

  const form = section.querySelector('.comment-form');
  const statusRow = form.querySelector('[data-comment-status]');
  const submitButton = form.querySelector('button[type="submit"]');
  const countLabel = section.querySelector('[data-comment-count]');
  const apiUrl = `/api/articles/${section.dataset.articleId}/comments`;
  // Set by the server for editors only (the API checks the role again on every request)
  const canModerate = section.dataset.canModerate === 'true';
  const maxText = form.elements.text.maxLength;

  const PAGE_SIZE = 20;
  const EMPTY_TEXT = 'יש לכתוב תגובה לפני השליחה';
  const NOT_FOUND = 'הכתבה כבר אינה זמינה';
  const GENERAL_PROBLEM = 'אירעה שגיאה. נסו שוב בעוד רגע';
  const NETWORK_PROBLEM = 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב';
  const DELETE_QUESTION = 'למחוק את התגובה? אי אפשר לבטל את המחיקה';
  const NO_PERMISSION = 'אין לך הרשאה לפעולה הזו. ייתכן שצריך להתחבר מחדש';
  const ALREADY_DELETED = 'התגובה כבר נמחקה';

  let total = Number(countLabel.textContent) || 0;

  // The list does not exist yet when the article has no comments
  function commentList() {
    let list = section.querySelector('.comment-list');
    if (!list) {
      list = document.createElement('div');
      list.className = 'comment-list';
      form.after(list);
    }
    return list;
  }

  // Builds the same markup as views/article.ejs. textContent (never innerHTML) puts the
  // guest's text in as plain text, so a comment like "<script>" is shown, not run.
  function renderComment(comment) {
    const item = document.createElement('article');
    item.className = 'comment';
    item.dataset.commentId = comment.id;

    const avatar = document.createElement('span');
    avatar.className = 'avatar';

    const name = document.createElement('strong');
    name.textContent = comment.name;

    const time = document.createElement('time');
    time.className = 'meta';
    time.dateTime = comment.createdAt;
    time.textContent = comment.time;

    const head = document.createElement('div');
    head.className = 'comment__head';
    head.append(name, time);

    const text = document.createElement('p');
    text.textContent = comment.text;

    const content = document.createElement('div');
    content.append(head, text);

    item.append(avatar, content);
    addModerationButtons(item);
    return item;
  }

  function setTotal(value) {
    total = value;
    countLabel.textContent = String(total);
  }

  // Replaces the red messages next to the button (also ones the server rendered without JS)
  function showProblems(messages) {
    statusRow.querySelectorAll('.alert-error').forEach(alert => alert.remove());
    for (const message of messages) {
      const alert = document.createElement('span');
      alert.className = 'alert alert-error';
      alert.setAttribute('role', 'alert');
      alert.textContent = message;
      statusRow.append(alert);
    }
  }

  // The server sends Hebrew messages in "messages"; anything else gets a general one
  function problemsFrom(res, body) {
    if (Array.isArray(body.messages) && body.messages.length) return body.messages;
    if (res.status === 404) return [NOT_FOUND];
    return [GENERAL_PROBLEM];
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const name = form.elements.name.value.trim();
    const text = form.elements.text.value.trim();
    // A quick check to save a round trip. The server checks again and has the final say.
    if (!text) {
      showProblems([EMPTY_TEXT]);
      return;
    }

    submitButton.disabled = true; // no double posting while the request is on its way
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, text }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status !== 201) {
        showProblems(problemsFrom(res, body));
        return;
      }

      commentList().prepend(renderComment(body.data));
      section.querySelector('[data-comment-empty]')?.remove();
      setTotal(total + 1);
      form.elements.text.value = ''; // the name stays for the next comment
      showProblems([]);
    } catch {
      showProblems([NETWORK_PROBLEM]);
    } finally {
      submitButton.disabled = false;
    }
  });

  // ----- Editors: edit and delete comments -----

  function makeButton(label, style, type = 'button') {
    const button = document.createElement('button');
    button.type = type;
    button.className = `btn ${style} btn-xs`;
    button.textContent = label;
    return button;
  }

  // Adds "עריכה" and "מחיקה" to one comment, only for editors
  function addModerationButtons(item) {
    if (!canModerate || item.querySelector('.comment__actions')) return;
    const edit = makeButton('עריכה', 'btn-outline');
    edit.dataset.commentAction = 'edit';
    const remove = makeButton('מחיקה', 'btn-danger');
    remove.dataset.commentAction = 'delete';

    const actions = document.createElement('span');
    actions.className = 'comment__actions';
    actions.append(edit, remove);
    item.querySelector('.comment__head').append(actions);
  }

  // A red message inside one comment (replaces an earlier one)
  function showItemProblem(container, message) {
    container.querySelectorAll('.alert-error').forEach(alert => alert.remove());
    const alert = document.createElement('span');
    alert.className = 'alert alert-error';
    alert.setAttribute('role', 'alert');
    alert.textContent = message;
    container.append(alert);
  }

  function moderationProblem(res, body) {
    if (Array.isArray(body.messages) && body.messages.length) return body.messages[0];
    if (res.status === 401 || res.status === 403) return NO_PERMISSION;
    return GENERAL_PROBLEM;
  }

  function commentUrl(item) {
    return `/api/comments/${item.dataset.commentId}`;
  }

  // Swaps the comment text for a small form with the text, "שמירה" and "ביטול"
  function startEditing(item) {
    if (item.querySelector('.comment-form')) return; // already open
    const textLine = item.querySelector('p');

    const textarea = document.createElement('textarea');
    textarea.name = 'text';
    textarea.required = true;
    textarea.maxLength = maxText;
    textarea.value = textLine.textContent;

    const save = makeButton('שמירה', 'btn-primary', 'submit');
    const cancel = makeButton('ביטול', 'btn-muted');
    const row = document.createElement('div');
    row.className = 'comment-form__row';
    row.append(save, cancel);

    const editForm = document.createElement('form');
    editForm.className = 'comment-form';
    editForm.append(textarea, row);

    textLine.hidden = true;
    textLine.after(editForm);
    textarea.focus();

    const close = () => {
      editForm.remove();
      textLine.hidden = false;
    };
    cancel.addEventListener('click', close);

    editForm.addEventListener('submit', async event => {
      event.preventDefault();
      const text = textarea.value.trim();
      if (!text) {
        showItemProblem(row, EMPTY_TEXT);
        return;
      }

      save.disabled = true;
      try {
        const res = await fetch(commentUrl(item), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ text }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          showItemProblem(row, res.status === 404 ? ALREADY_DELETED : moderationProblem(res, body));
          return;
        }
        textLine.textContent = body.data.text;
        close();
      } catch {
        showItemProblem(row, NETWORK_PROBLEM);
      } finally {
        save.disabled = false;
      }
    });
  }

  async function deleteComment(item, button) {
    if (!window.confirm(DELETE_QUESTION)) return;

    button.disabled = true;
    try {
      const res = await fetch(commentUrl(item), { method: 'DELETE', headers: { Accept: 'application/json' } });
      // 404: another editor already deleted it, so it goes away here too
      if (res.status !== 204 && res.status !== 404) {
        const body = await res.json().catch(() => ({}));
        showItemProblem(item.lastElementChild, moderationProblem(res, body));
        return;
      }
      item.remove();
      setTotal(Math.max(total - 1, 0));
    } catch {
      showItemProblem(item.lastElementChild, NETWORK_PROBLEM);
    } finally {
      button.disabled = false;
    }
  }

  // One listener for every comment, including ones added later by "load more" or a new post
  section.addEventListener('click', event => {
    const button = event.target.closest('[data-comment-action]');
    if (!button) return;
    const item = button.closest('.comment');
    if (button.dataset.commentAction === 'edit') startEditing(item);
    if (button.dataset.commentAction === 'delete') deleteComment(item, button);
  });

  section.querySelectorAll('.comment').forEach(addModerationButtons);

  // Without JavaScript the page shows a line like "מוצגות 20 התגובות האחרונות מתוך 25".
  // With JavaScript that line becomes a button that loads the next comments.
  const moreHint = section.querySelector('[data-comment-more]');
  if (!moreHint) return;

  const moreButton = document.createElement('button');
  moreButton.type = 'button';
  moreButton.className = 'btn btn-outline btn-sm';
  moreButton.textContent = 'טעינת תגובות נוספות';
  moreHint.replaceWith(moreButton);

  moreButton.addEventListener('click', async () => {
    const list = commentList();
    moreButton.disabled = true;
    try {
      // skip = how many are already on the page (including ones just posted, which are newest)
      const res = await fetch(`${apiUrl}?limit=${PAGE_SIZE}&skip=${list.children.length}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data, meta } = await res.json();

      // Comments others posted since the page loaded push older ones down, so one may come back twice
      for (const comment of data) {
        if (!list.querySelector(`[data-comment-id="${comment.id}"]`)) list.append(renderComment(comment));
      }
      setTotal(meta.total);

      if (!data.length || list.children.length >= meta.total) {
        moreButton.remove();
        return;
      }
      moreButton.textContent = 'טעינת תגובות נוספות';
    } catch {
      moreButton.textContent = 'הטעינה נכשלה. לחצו לנסות שוב';
    } finally {
      moreButton.disabled = false;
    }
  });
})();
