// Runs the public article page and its comment routes end to end (real routes, middleware,
// controllers, presenters and EJS views) against stand-ins for the database and for logging.
// Covers: the page shows only the approved version, 404s, comments with and without
// JavaScript, the 3-comments-a-minute limit, editor moderation and view counting.
// Run with: npm test

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const mongoose = require('mongoose');

// Logging and analytics are replaced before the controllers load (they keep their own reference)
const events = [];
const logs = [];
require('../services/analyticsService').recordUsageEvent = async values => { events.push(values); return true; };
require('../services/loggingService').recordLog = async values => { logs.push(values); return true; };

const express = require('express');
const { installFakeComments } = require('./helpers/fakeComments');
const publicArticleService = require('../services/publicArticleService');
const weatherService = require('../services/weatherService');
const commentRateLimit = require('../middleware/commentRateLimit');
const { notFound, errorHandler } = require('../middleware/errorHandler');

const fake = installFakeComments();

// ---- the articles the fake database knows ----
const PUBLIC_ID = '64b0000000000000000000a1';
const OTHER_ID = '64b0000000000000000000b2';
const articles = {
  [PUBLIC_ID]: {
    _id: new mongoose.Types.ObjectId(PUBLIC_ID),
    views: 41,
    author: { name: 'דנה לוי' },
    // The working copy (title/body) has an edit the editor has not approved yet
    title: 'כותרת (עדכון)',
    body: 'טקסט שלא אושר',
    liveVersion: {
      title: 'כותרת מאושרת',
      summary: 'תקציר',
      body: 'פסקה ראשונה\n\nפסקה שנייה',
      category: 'ספורט',
      image: null,
      version: 1,
      publishedAt: new Date('2026-10-01T09:00:00Z'),
    },
  },
};
articles[OTHER_ID] = { ...articles[PUBLIC_ID], _id: new mongoose.Types.ObjectId(OTHER_ID) };

// The page only ever gets articles that have a liveVersion (the real query filters on it)
publicArticleService.findPublicArticle = async id => articles[id] || null;
publicArticleService.findRelated = async () => [];
const increments = [];
publicArticleService.incrementViews = async id => { increments.push(String(id)); };
weatherService.getLocalWeather = async () => ({ weather: null, forecast: null });

// ---- the app: only the routes of the article page ----
function buildApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  app.locals.categories = require('../config/categories');
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  // Stand-in for the login session: the x-test-role header says who is asking
  app.use((req, res, next) => {
    const role = req.get('x-test-role');
    req.session = role ? { user: { id: '64b0000000000000000000e1', name: 'עורכת', username: 'editor01', role } } : {};
    res.locals.currentUser = req.session.user || null;
    next();
  });
  app.use('/api/articles', require('../routes/api/articleCommentsRoutes'));
  app.use('/api/comments', require('../routes/api/commentsRoutes'));
  app.use('/articles', require('../routes/articleRoutes'));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

let server;
let base;
const request = (url, { method = 'GET', role, form, json } = {}) => {
  const headers = {};
  let body;
  if (role) headers['x-test-role'] = role;
  if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  return fetch(base + url, { method, headers, body, redirect: 'manual' });
};
const page = url => request(url).then(async res => ({ status: res.status, html: await res.text() }));
const postApi = text => request(`/api/articles/${PUBLIC_ID}/comments`, { method: 'POST', json: { text } });
const postForm = (text, name = '') => request(`/articles/${PUBLIC_ID}/comments`, { method: 'POST', form: { name, text } });

before(async () => {
  server = buildApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

beforeEach(() => {
  fake.reset();
  events.length = 0;
  logs.length = 0;
  increments.length = 0;
  // Every test starts with a fresh limit (the counts live in the limiter's memory)
  commentRateLimit.resetKey('127.0.0.1');
});

describe('article page', () => {
  it('shows the full approved version in the first HTML (works without JavaScript)', async () => {
    const { status, html } = await page(`/articles/${PUBLIC_ID}`);
    assert.strictEqual(status, 200);
    assert.match(html, /<title>כותרת מאושרת · The Daily Web<\/title>/);
    assert.match(html, /<p>פסקה ראשונה<\/p>[\s\S]*<p>פסקה שנייה<\/p>/);
    assert.match(html, /דנה לוי/);
  });

  it('never shows the working copy (an edit that was not approved)', async () => {
    const { html } = await page(`/articles/${PUBLIC_ID}`);
    assert.doesNotMatch(html, /כותרת \(עדכון\)|טקסט שלא אושר/);
  });

  it('404 for a malformed id, an unknown article, or one that was never approved', async () => {
    for (const id of ['abc', '0'.repeat(25), '64b0000000000000000000ff']) {
      assert.strictEqual((await page(`/articles/${id}`)).status, 404, id);
    }
  });

  it('shows the category illustration when there is no uploaded image', async () => {
    const { html } = await page(`/articles/${PUBLIC_ID}`);
    assert.match(html, /<img src="\/images\/categories\/sports\.svg" alt="" class="article__img">/);
  });

  it('has a back link that works without JavaScript (a plain link to the home page)', async () => {
    const { html } = await page(`/articles/${PUBLIC_ID}`);
    assert.match(html, /<a href="\/" [^>]*data-back-link>→ חזרה<\/a>/);
  });
});

describe('comments without JavaScript (the form)', () => {
  it('saves a comment and redirects back to it (Post/Redirect/Get)', async () => {
    const res = await postForm('תגובה חדשה', 'יעל');
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get('location'), `/articles/${PUBLIC_ID}#comments`);
    const { html } = await page(`/articles/${PUBLIC_ID}`);
    assert.match(html, /תגובות \(<span data-comment-count>1<\/span>\)/);
    assert.match(html, /<strong>יעל<\/strong>/);
  });

  it('invalid input: the page again with a Hebrew message and the typed name kept', async () => {
    const res = await postForm('   ', 'דני');
    const html = await res.text();
    assert.strictEqual(res.status, 400);
    assert.match(html, /יש לכתוב תגובה/);
    assert.match(html, /value="דני"/);
  });

  it('escapes user text (no HTML from a comment reaches the page)', async () => {
    await postForm('<script>alert(1)</script>');
    const { html } = await page(`/articles/${PUBLIC_ID}`);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });
});

describe('comments API (used by public/js/comments.js)', () => {
  it('POST returns 201 with the new comment, never the ip', async () => {
    const res = await postApi('דרך Ajax');
    const { data } = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.text, 'דרך Ajax');
    assert.ok(!('ip' in data));
  });

  it('POST with invalid input returns 400 with Hebrew messages', async () => {
    const res = await postApi('');
    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.match(body.messages[0], /יש לכתוב תגובה/);
  });

  it('GET pages through the comments, newest first', async () => {
    fake.seed(PUBLIC_ID, 25);
    const res = await request(`/api/articles/${PUBLIC_ID}/comments?limit=20&skip=20`);
    const { data, meta } = await res.json();
    assert.deepStrictEqual(meta, { total: 25, limit: 20, skip: 20 });
    assert.strictEqual(data.length, 5);
  });

  it('404 as JSON for an article that is not public', async () => {
    const res = await request('/api/articles/64b0000000000000000000ff/comments');
    assert.strictEqual(res.status, 404);
    assert.ok((await res.json()).error);
  });
});

describe('spam limit: 3 comments a minute per device', () => {
  it('the 4th comment in a minute gets 429 with the Hebrew message and a Retry-After', async () => {
    for (let i = 1; i <= 3; i++) assert.strictEqual((await postApi(`תגובה ${i}`)).status, 201);
    const res = await postApi('רביעית');
    const body = await res.json();
    assert.strictEqual(res.status, 429);
    assert.deepStrictEqual(body.messages, ['חרגת מהמגבלה — נסו שוב בעוד דקה']);
    const retryAfter = Number(res.headers.get('retry-after'));
    assert.ok(retryAfter >= 1 && retryAfter <= 60);
    assert.strictEqual(fake.store.length, 3);
  });

  it('the form and the API share the same count, and the form gets the article page with the message', async () => {
    await postApi('1');
    await postForm('2');
    await postApi('3');
    const res = await postForm('בלי JS', 'דני');
    const html = await res.text();
    assert.strictEqual(res.status, 429);
    assert.match(html, /כותרת מאושרת/);
    assert.match(html, /חרגת מהמגבלה/);
    assert.match(html, /בלי JS<\/textarea>/);
  });

  it('rejected comments (400) do not use up the 3', async () => {
    await postApi('');
    await postApi('   ');
    for (let i = 1; i <= 3; i++) assert.strictEqual((await postApi(`תגובה ${i}`)).status, 201);
  });

  it('counts per device, not per article', async () => {
    for (let i = 1; i <= 3; i++) await postApi(`תגובה ${i}`);
    const res = await request(`/api/articles/${OTHER_ID}/comments`, { method: 'POST', json: { text: 'כתבה אחרת' } });
    assert.strictEqual(res.status, 429);
  });

  it('reading comments is never limited', async () => {
    for (let i = 1; i <= 3; i++) await postApi(`תגובה ${i}`);
    assert.strictEqual((await request(`/api/articles/${PUBLIC_ID}/comments`)).status, 200);
  });
});

describe('editors: edit and delete comments', () => {
  const addComment = async () => {
    await postApi('תגובה לבדיקה');
    return String(fake.store[0]._id);
  };

  it('guests get 401 and reporters 403 (checked on the server)', async () => {
    const id = await addComment();
    assert.strictEqual((await request(`/api/comments/${id}`, { method: 'PATCH', json: { text: 'x' } })).status, 401);
    assert.strictEqual((await request(`/api/comments/${id}`, { method: 'DELETE', role: 'reporter' })).status, 403);
    assert.strictEqual(fake.store.length, 1);
  });

  it('an editor can edit a comment, and the action is logged without the comment text', async () => {
    const id = await addComment();
    const res = await request(`/api/comments/${id}`, { method: 'PATCH', role: 'editor', json: { text: 'תוקן' } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).data.text, 'תוקן');
    assert.strictEqual(logs[0].event, 'comment_updated');
    assert.doesNotMatch(logs[0].message, /תוקן/);
  });

  it('an editor can delete a comment (204), then it is gone (404)', async () => {
    const id = await addComment();
    assert.strictEqual((await request(`/api/comments/${id}`, { method: 'DELETE', role: 'editor' })).status, 204);
    assert.strictEqual((await request(`/api/comments/${id}`, { method: 'DELETE', role: 'editor' })).status, 404);
    assert.strictEqual(logs[0].event, 'comment_deleted');
  });

  it('only editors get the moderation hook on the page', async () => {
    const guest = await page(`/articles/${PUBLIC_ID}`);
    const editor = await request(`/articles/${PUBLIC_ID}`, { role: 'editor' }).then(res => res.text());
    assert.doesNotMatch(guest.html, /data-can-moderate/);
    assert.match(editor, /data-can-moderate="true"/);
  });
});

describe('view counting', () => {
  it('every visit records an article_view event and adds 1 to the total', async () => {
    await page(`/articles/${PUBLIC_ID}`);
    await page(`/articles/${PUBLIC_ID}`);
    assert.strictEqual(events.filter(e => e.type === 'article_view' && String(e.articleId) === PUBLIC_ID).length, 2);
    assert.deepStrictEqual(increments, [PUBLIC_ID, PUBLIC_ID]);
  });

  it('comments, error pages and 404s are not counted', async () => {
    await postForm('תגובה');
    await postForm('');
    await page('/articles/64b0000000000000000000ff');
    await request(`/api/articles/${PUBLIC_ID}/comments`);
    assert.strictEqual(events.length, 0);
    assert.strictEqual(increments.length, 0);
  });

  it('the page still loads if counting fails', async () => {
    const original = publicArticleService.incrementViews;
    publicArticleService.incrementViews = async () => { throw new Error('database down'); };
    const realConsoleError = console.error;
    console.error = () => {};
    try {
      assert.strictEqual((await page(`/articles/${PUBLIC_ID}`)).status, 200);
    } finally {
      publicArticleService.incrementViews = original;
      console.error = realConsoleError;
    }
  });
});
