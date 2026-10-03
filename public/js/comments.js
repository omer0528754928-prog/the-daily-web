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

  const PAGE_SIZE = 20;
  const EMPTY_TEXT = 'יש לכתוב תגובה לפני השליחה';
  const NOT_FOUND = 'הכתבה כבר אינה זמינה';
  const GENERAL_PROBLEM = 'אירעה שגיאה. נסו שוב בעוד רגע';
  const NETWORK_PROBLEM = 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב';

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
