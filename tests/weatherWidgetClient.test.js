// Tests public/js/weather.js (the browser script that refreshes the weather widget) without a browser.
// The script runs inside a vm sandbox with a fake page, server, clock, timers and console,
// so each test can decide what the server answers and when time passes, and check what the widget did.
// Run with: npm test

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPT = fs.readFileSync(path.join(__dirname, '../public/js/weather.js'), 'utf8');
const SEC = 1000;
const MIN = 60 * SEC;

// the widget HTML the server renders; fetchedAt = null -> no data-fetched-at (the page had no weather)
const widgetHtml = (fetchedAt) => fetchedAt == null
  ? '<section class="widget weather">no weather</section>'
  : `<section class="widget weather" data-fetched-at="${fetchedAt}">weather</section>`;

// ---- fake clock ----
let clock;

// ---- fake timers ----
// setTimeout only records the callback and when it is due; passTime() moves the clock and runs what is due.
// Like the browser, a NaN / negative delay means "as soon as possible".
let timers;
let nextTimerId;
function fakeSetTimeout(fn, ms) {
  const delay = Number(ms) > 0 ? Number(ms) : 0;
  timers.set(++nextTimerId, { fn, at: clock + delay });
  return nextTimerId;
}
function fakeClearTimeout(id) { timers.delete(id); }
const pendingTimers = () => [...timers.values()];

// the script doesn't await its own promises, so let them finish before checking
const settle = () => new Promise(resolve => setImmediate(resolve));

async function passTime(ms) {
  const end = clock + ms;
  for (let fired = 0; ; fired++) {
    if (fired > 1000) throw new Error('timers keep firing - endless refresh loop');
    const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    const [id, timer] = due;
    timers.delete(id);
    clock = timer.at;
    timer.fn();
    await settle();
  }
  clock = end;
}

// ---- fake page ----
// widget is what document.querySelector finds (null = the widget isn't on the page).
// Setting its outerHTML replaces it with a new widget built from that HTML, like the browser does.
// page.hide() / page.show() switch document.hidden and fire the visibilitychange listeners.
let widget;
let page;
function makeWidget(html) {
  const match = html.match(/data-fetched-at="(\d+)"/);
  const w = { dataset: match ? { fetchedAt: match[1] } : {} };
  Object.defineProperty(w, 'outerHTML', {
    get: () => html,
    set: (newHtml) => { if (widget === w) widget = makeWidget(newHtml); },
  });
  return w;
}
function fakePage(fetchedAt) {
  widget = makeWidget(widgetHtml(fetchedAt));
  page = {
    listeners: {},
    document: {
      hidden: false,
      querySelector: () => widget,
      addEventListener: (type, fn) => { (page.listeners[type] ||= []).push(fn); },
    },
  };
  const setHidden = async (hidden) => {
    page.document.hidden = hidden;
    (page.listeners.visibilitychange || []).forEach(fn => fn());
    await settle();
  };
  page.hide = () => setHidden(true);
  page.show = () => setHidden(false);
}

// ---- fake server ----
// server.answer decides how the next fetch behaves:
//   { status: 200 }            -> new data, fetched now
//   { status: 200, fetchedAt } -> old data (the server's cache/fallback), fetched at that time
//   { status: 404 / 503 }      -> an error response
//   'network'                  -> fetch rejects, like when the user is offline
// server.hold() makes requests wait until server.release(), to test a refresh that is still in progress.
let server;
function fakeServer() {
  server = { calls: [], lastCallAt: null, answer: { status: 200 }, gate: null };
  server.hold = () => { server.gate = new Promise(resolve => { server.release = resolve; }); };
  return async (url) => {
    server.calls.push(url);
    server.lastCallAt = clock;
    if (server.gate) await server.gate;
    const { answer } = server;
    if (answer === 'network') throw new TypeError('Failed to fetch');
    const ok = answer.status >= 200 && answer.status < 300;
    const body = ok ? widgetHtml(answer.fetchedAt ?? clock) : 'Service Unavailable';
    return { ok, status: answer.status, text: async () => body };
  };
}

// ---- fake console ----
let errors;
const fakeConsole = {
  log: () => {},
  warn: (...args) => errors.push(args),
  error: (...args) => errors.push(args),
};

// Opens the page: the widget on it was fetched by the server at pageFetchedAt (null = no weather),
// then runs weather.js in a fresh sandbox and returns the sandbox.
function openPage(pageFetchedAt) {
  fakePage(pageFetchedAt);
  timers = new Map();
  nextTimerId = 0;
  errors = [];
  const sandbox = vm.createContext({
    document: page.document,
    fetch: fakeServer(),
    console: fakeConsole,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    setInterval: () => { throw new Error('weather.js should schedule with setTimeout'); },
    Date: class extends Date { static now() { return clock; } },
  });
  vm.runInContext(SCRIPT, sandbox);
  return sandbox;
}

describe('weather widget refresh (public/js/weather.js)', () => {
  let sandbox;
  let refreshWeather;

  // by default the page shows weather the server fetched 10 minutes ago
  beforeEach(() => {
    clock = 1_790_000_000_000;
    sandbox = openPage(clock - 10 * MIN);
    refreshWeather = vm.runInContext('refreshWeather', sandbox);
  });

  describe('one refresh', () => {
    it('asks the server for /weather-widget', async () => {
      await refreshWeather();
      assert.deepStrictEqual(server.calls, ['/weather-widget']);
    });

    it('replaces the widget with the HTML the server sent', async () => {
      await refreshWeather();
      assert.strictEqual(widget.outerHTML, widgetHtml(clock));
      assert.strictEqual(errors.length, 0);
    });

    it('keeps the old widget when the weather API is down (503)', async () => {
      const before = widget;
      server.answer = { status: 503 };
      await refreshWeather();
      assert.strictEqual(widget, before);
      assert.match(String(errors[0]?.[0]), /503/);
    });

    it('keeps the old widget when the route does not exist (404)', async () => {
      const before = widget;
      server.answer = { status: 404 };
      await refreshWeather();
      assert.strictEqual(widget, before);
      assert.match(String(errors[0]?.[0]), /404/);
    });

    it('keeps the old widget and does not throw when the network fails', async () => {
      const before = widget;
      server.answer = 'network';
      await assert.doesNotReject(refreshWeather());
      assert.strictEqual(widget, before);
      assert.strictEqual(errors.length, 1);
    });

    it('does not call the server when the widget is not on the page', async () => {
      widget = null;
      await refreshWeather();
      assert.strictEqual(server.calls.length, 0);
    });
  });

  describe('schedule (3j)', () => {
    it('uses a 15 minute refresh time', () => {
      assert.strictEqual(vm.runInContext('REFRESH_MS', sandbox), 15 * MIN, 'still set to a short test value?');
    });

    it('does not refresh on page load (the page already has fresh data)', async () => {
      await settle();
      assert.strictEqual(server.calls.length, 0);
    });

    it('schedules the first refresh for when the server data expires, not 15 min after page load', async () => {
      // data from 10 min ago -> expires in 5 min (+ the margin)
      await passTime(5 * MIN);
      assert.strictEqual(server.calls.length, 0, 'too early - the server cache has not expired yet');
      await passTime(10 * SEC);
      assert.strictEqual(server.calls.length, 1);
      assert.strictEqual(widget.dataset.fetchedAt, String(server.lastCallAt));
    });

    it('keeps refreshing: each refresh schedules the next one from the new data', async () => {
      await passTime(5 * MIN + 10 * SEC); // first refresh
      await passTime(15 * MIN + 10 * SEC); // 15 min after the new data
      await passTime(15 * MIN + 10 * SEC);
      assert.strictEqual(server.calls.length, 3);
    });

    it('never has more than one refresh waiting', async () => {
      assert.strictEqual(pendingTimers().length, 1);
      await passTime(5 * MIN + 10 * SEC);
      assert.strictEqual(pendingTimers().length, 1);
      await page.hide();
      await page.show();
      assert.strictEqual(pendingTimers().length, 1);
    });

    it('API down: retries once a minute, not in a loop', async () => {
      server.answer = { status: 503 };
      await passTime(5 * MIN + 10 * SEC); // first try after the data expired
      await passTime(5 * MIN);
      assert.strictEqual(server.calls.length, 6);
    });

    it('server sends back the same old data: retries once a minute, not in a loop', async () => {
      server.answer = { status: 200, fetchedAt: clock - 10 * MIN };
      await passTime(5 * MIN + 10 * SEC);
      await passTime(5 * MIN);
      assert.strictEqual(server.calls.length, 6);
    });

    it('page loaded without weather (no fetchedAt): one timer, first try after a minute', async () => {
      openPage(null);
      assert.strictEqual(pendingTimers().length, 1);
      await passTime(59 * SEC);
      assert.strictEqual(server.calls.length, 0, 'should not fire right away');
      await passTime(1 * SEC);
      assert.strictEqual(server.calls.length, 1);
    });

    it('recovers when the API comes back', async () => {
      server.answer = { status: 503 };
      await passTime(5 * MIN + 10 * SEC);
      server.answer = { status: 200 };
      await passTime(1 * MIN);
      assert.strictEqual(widget.dataset.fetchedAt, String(server.lastCallAt));
      const calls = server.calls.length;
      await passTime(14 * MIN); // new data is fresh again - back to the normal schedule
      assert.strictEqual(server.calls.length, calls);
    });
  });

  describe('hidden tab (3f / 3j-7)', () => {
    it('does not call the server while the tab is hidden', async () => {
      await page.hide();
      await passTime(60 * MIN);
      assert.strictEqual(server.calls.length, 0);
    });

    it('stops the timer while hidden instead of firing every minute', async () => {
      await page.hide();
      await passTime(60 * MIN);
      assert.strictEqual(pendingTimers().length, 0);
    });

    it('starts the chain again when the user comes back', async () => {
      await page.hide();
      await passTime(60 * MIN);
      await page.show();
      assert.strictEqual(server.calls.length, 1);
      assert.strictEqual(pendingTimers().length, 1);
      await passTime(15 * MIN + 10 * SEC);
      assert.strictEqual(server.calls.length, 2);
    });
  });

  describe('coming back to the tab (3g / 3j-6)', () => {
    it('refreshes right away when the data expired while the tab was hidden', async () => {
      await page.hide();
      await passTime(30 * MIN);
      await page.show();
      assert.strictEqual(server.calls.length, 1);
      assert.strictEqual(widget.dataset.fetchedAt, String(clock));
    });

    it('does not refresh again right after that', async () => {
      await page.hide();
      await passTime(30 * MIN);
      await page.show();
      await passTime(2 * MIN);
      assert.strictEqual(server.calls.length, 1);
    });

    it('does not refresh when the data is still fresh, and keeps the existing timer', async () => {
      await page.hide();
      await passTime(1 * MIN);
      await page.show();
      assert.strictEqual(server.calls.length, 0);
      await passTime(4 * MIN + 10 * SEC); // the original schedule still fires on time
      assert.strictEqual(server.calls.length, 1);
    });

    it('does nothing when the tab is hidden', async () => {
      await passTime(4 * MIN);
      await page.hide();
      assert.strictEqual(server.calls.length, 0);
    });

    it('refreshes right away when the page has no fetchedAt', async () => {
      openPage(null);
      await page.hide();
      await page.show();
      assert.strictEqual(server.calls.length, 1);
    });

    it('comes back with fresh data after the chain stopped: starts the timer again', async () => {
      // the server sent data that is fresh again while the tab was hidden (e.g. from another open tab)
      openPage(clock - 20 * MIN); // expired -> retry timer in a minute
      await page.hide();
      await passTime(1 * MIN);    // the retry fires while hidden -> chain stops
      assert.strictEqual(pendingTimers().length, 0);
      widget = makeWidget(widgetHtml(clock)); // pretend the page got fresh data
      await page.show();
      assert.strictEqual(server.calls.length, 0, 'data is fresh - no refresh needed');
      assert.strictEqual(pendingTimers().length, 1, 'but the timer must be running again');
    });

    it('a waiting timer does not fire a second refresh while the return refresh is in progress', async () => {
      openPage(clock - 20 * MIN); // expired -> retry timer in a minute
      server.hold();
      await passTime(59 * SEC);
      await page.hide();
      await page.show();          // refresh #1 starts, the request is held
      await passTime(2 * SEC);    // the old timer would fire here
      server.release();
      await settle();
      assert.strictEqual(server.calls.length, 1);
      assert.strictEqual(pendingTimers().length, 1);
    });

    it('switching tabs quickly during a refresh does not start another one', async () => {
      await page.hide();
      await passTime(30 * MIN);
      server.hold();
      await page.show();          // refresh #1 starts, the request is held
      await page.hide();
      await page.show();          // still expired -> would start refresh #2
      server.release();
      await settle();
      assert.strictEqual(server.calls.length, 1);
      assert.strictEqual(pendingTimers().length, 1);
    });

    it('a failed refresh on return still leaves a retry scheduled', async () => {
      await page.hide();
      await passTime(30 * MIN);
      server.answer = { status: 503 };
      await page.show();
      server.answer = { status: 200 };
      await passTime(1 * MIN);
      assert.strictEqual(server.calls.length, 2);
      assert.strictEqual(widget.dataset.fetchedAt, String(clock));
    });
  });
});
