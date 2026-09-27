// Tests public/js/weather.js (the browser script that refreshes the weather widget) without a browser.
// The script runs inside a vm sandbox with a fake document, fetch and console,
// so each test can decide what the server answers and check what happened to the widget.
// Run with: npm test

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPT = fs.readFileSync(path.join(__dirname, '../public/js/weather.js'), 'utf8');
const OLD_HTML = '<section class="widget weather">old</section>';
const NEW_HTML = '<section class="widget weather">new</section>';

// ---- fake page ----
// widget is what document.querySelector finds (null = the widget isn't on the page)
// page.document.hidden says whether the tab is in the background; page.show() / page.hide() switch it
// and fire the visibilitychange listeners the script registered, like the browser does.
let widget;
let page;
function fakePage() {
  widget = { outerHTML: OLD_HTML };
  page = {
    selectors: [],
    listeners: {},
    document: {
      hidden: false,
      querySelector: (selector) => { page.selectors.push(selector); return widget; },
      addEventListener: (type, fn) => { (page.listeners[type] ||= []).push(fn); },
    },
  };
  const setHidden = (hidden) => {
    page.document.hidden = hidden;
    (page.listeners.visibilitychange || []).forEach(fn => fn());
  };
  page.hide = () => setHidden(true);
  page.show = () => setHidden(false);
}

// ---- fake clock ----
// Date.now() inside the script returns clock; advance(ms) moves it forward.
let clock;
function advance(ms) { clock += ms; }
class FakeDate extends Date {
  static now() { return clock; }
}

// ---- fake timers ----
// setInterval only records what the script asked for; tick() runs the interval callbacks once,
// like one period passing in the browser.
let intervals;
function tick() { intervals.forEach(({ fn }) => fn()); }

// the listener doesn't await refreshWeather, so let its promises finish before checking
const settle = () => new Promise(resolve => setImmediate(resolve));

// ---- fake server ----
// server.answer decides how the next fetch behaves:
//   { status: 200, body }  -> a normal response
//   { status: 404 / 503 }  -> an error response
//   'network'              -> fetch rejects, like when the user is offline
let server;
function fakeServer() {
  server = { calls: [], answer: { status: 200, body: NEW_HTML } };
  return async (url) => {
    server.calls.push(url);
    const { answer } = server;
    if (answer === 'network') throw new TypeError('Failed to fetch');
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, text: async () => answer.body };
  };
}

// ---- fake console ----
let errors;
const fakeConsole = {
  log: () => {},
  warn: (...args) => errors.push(args),
  error: (...args) => errors.push(args),
};

// Runs weather.js in a fresh sandbox and returns the sandbox, so tests can read its
// refreshWeather function and REFRESH_MS constant.
// If the script refreshes on load, the widget is hidden while it loads so that call returns early.
function loadScript() {
  const loadedWidget = widget;
  widget = null;
  intervals = [];
  const sandbox = vm.createContext({
    document: page.document,
    fetch: fakeServer(),
    console: fakeConsole,
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
    setTimeout: () => 0,
    Date: FakeDate,
  });
  vm.runInContext(SCRIPT, sandbox);
  widget = loadedWidget;
  server.calls = [];
  page.selectors = [];
  return sandbox;
}

describe('weather widget refresh (public/js/weather.js)', () => {
  let sandbox;
  let refreshWeather;
  let REFRESH_MS;

  beforeEach(() => {
    fakePage();
    errors = [];
    clock = 1_000_000;
    sandbox = loadScript();
    refreshWeather = vm.runInContext('refreshWeather', sandbox);
    REFRESH_MS = vm.runInContext('REFRESH_MS', sandbox);
  });

  it('asks the server for /weather-widget', async () => {
    await refreshWeather();
    assert.deepStrictEqual(server.calls, ['/weather-widget']);
  });

  it('replaces the widget with the HTML the server sent', async () => {
    await refreshWeather();
    assert.strictEqual(widget.outerHTML, NEW_HTML);
    assert.strictEqual(errors.length, 0);
  });

  it('keeps the old widget when the weather API is down (503)', async () => {
    server.answer = { status: 503 };
    await refreshWeather();
    assert.strictEqual(widget.outerHTML, OLD_HTML);
    assert.match(String(errors[0]?.[0]), /503/);
  });

  it('keeps the old widget when the route does not exist (404)', async () => {
    server.answer = { status: 404 };
    await refreshWeather();
    assert.strictEqual(widget.outerHTML, OLD_HTML);
    assert.match(String(errors[0]?.[0]), /404/);
  });

  it('keeps the old widget and does not throw when the network fails', async () => {
    server.answer = 'network';
    await assert.doesNotReject(refreshWeather());
    assert.strictEqual(widget.outerHTML, OLD_HTML);
    assert.strictEqual(errors.length, 1);
  });

  it('does not call the server when the widget is not on the page', async () => {
    widget = null;
    await refreshWeather();
    assert.strictEqual(server.calls.length, 0);
    assert.strictEqual(errors.length, 0);
  });

  describe('timer (3e)', () => {
    it('refreshes every 15 minutes', () => {
      assert.strictEqual(REFRESH_MS, 15 * 60 * 1000, 'REFRESH_MS should be 15 minutes - still set to a short test value?');
      assert.strictEqual(intervals.length, 1);
      assert.strictEqual(intervals[0].ms, REFRESH_MS);
    });

    it('does not refresh on page load (the page already has fresh data)', () => {
      assert.strictEqual(server.calls.length, 0);
    });

    it('refreshes the widget when the timer fires', async () => {
      tick();
      await settle();
      assert.strictEqual(server.calls.length, 1);
      assert.strictEqual(widget.outerHTML, NEW_HTML);
    });
  });

  describe('hidden tab (3f)', () => {
    it('skips the timer refresh while the tab is hidden', async () => {
      page.hide();
      tick();
      tick();
      await settle();
      assert.strictEqual(server.calls.length, 0);
      assert.strictEqual(widget.outerHTML, OLD_HTML);
    });
  });

  describe('coming back to the tab (3g)', () => {
    it('refreshes right away when the data is older than REFRESH_MS', async () => {
      page.hide();
      advance(REFRESH_MS);
      page.show();
      await settle();
      assert.strictEqual(server.calls.length, 1);
      assert.strictEqual(widget.outerHTML, NEW_HTML);
    });

    it('works even before the timer ever fired (page loaded, then left for a long time)', async () => {
      page.hide();
      tick(); // skipped - the tab is hidden
      advance(60 * 60 * 1000);
      page.show();
      await settle();
      assert.strictEqual(server.calls.length, 1);
    });

    it('does not refresh when the user comes back quickly', async () => {
      page.hide();
      advance(REFRESH_MS - 1);
      page.show();
      await settle();
      assert.strictEqual(server.calls.length, 0);
    });

    it('does nothing when the tab is hidden', async () => {
      advance(REFRESH_MS);
      page.hide();
      await settle();
      assert.strictEqual(server.calls.length, 0);
    });

    it('counts only successful refreshes', async () => {
      advance(REFRESH_MS);
      server.answer = { status: 503 };
      tick(); // fails - the data on the page is still old
      await settle();
      page.hide();
      page.show();
      await settle();
      assert.strictEqual(server.calls.length, 2, 'a failed refresh should not reset lastRefresh');
    });

    it('does not refresh again right after a successful refresh', async () => {
      advance(REFRESH_MS);
      tick();
      await settle();
      page.hide();
      page.show();
      await settle();
      assert.strictEqual(server.calls.length, 1);
    });
  });
});
