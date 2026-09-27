// Tests every cache / failure case of services/weatherService.js without touching the real API.
// fetch and Date.now are replaced with fakes so each test can put the service into the exact state it needs.
// Run with: npm test

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const SERVICE = require.resolve('../services/weatherService');
const MIN = 60 * 1000;
const realFetch = global.fetch;
const realNow = Date.now;
const realConsoleError = console.error;

// fresh copy of the module = empty cache, nothing pending, never failed
function loadService() {
  delete require.cache[SERVICE];
  return require(SERVICE);
}

// ---- fake clock ----
let now;
function advance(ms) { now += ms; }

// ---- fake OpenWeatherMap ----
// api.mode decides how the next call behaves:
//   'ok'      -> 200 with valid data (api.temp is the temperature, so we can tell old data from new)
//   'fail'    -> HTTP 500
//   'badjson' -> 200 but the JSON has the wrong shape
//   'hang'    -> never answers (only the timeout can end it)
// api.hold() makes calls wait until api.release(), to test "a call is already pending".
let api;
function fakeApi() {
  api = { calls: 0, mode: 'ok', temp: 20, gate: null };
  api.hold = () => { api.gate = new Promise(resolve => { api.release = resolve; }); };

  global.fetch = async (url, opts) => {
    api.calls++;
    if (api.gate) await api.gate;
    const { mode, temp } = api; // read after the gate, so a held call uses the mode set before release()

    if (mode === 'hang') {
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => reject(opts.signal.reason));
      });
    }
    if (mode === 'fail') return { ok: false, status: 500 };
    if (mode === 'badjson') return { ok: true, json: async () => ({}) };
    return { ok: true, json: async () => (url.includes('/forecast') ? forecastPayload(temp) : weatherPayload(temp)) };
  };
}

function weatherPayload(temp) {
  return { name: 'Tel Aviv', main: { temp, humidity: 50 }, weather: [{ main: 'Clear', description: 'בהיר', icon: '01d' }] };
}

function forecastPayload(temp) {
  const DAY = 24 * 60 * 60;
  const nowSec = Math.floor(Date.now() / 1000);
  const startOfToday = nowSec - (nowSec % DAY);
  // one entry at noon for each of the next 4 days
  const list = [1, 2, 3, 4].map(d => ({ dt: startOfToday + d * DAY + 12 * 60 * 60, main: { temp } }));
  return { city: { timezone: 0 }, list };
}

// The same cases apply to both functions; only the way we read the temperature differs.
const targets = [
  { name: 'getCurrentWeather', call: (s, lat = 1, lon = 2) => s.getCurrentWeather('key', lat, lon), temp: r => r && r.temp },
  { name: 'getForecast',       call: (s, lat = 1, lon = 2) => s.getForecast('key', lat, lon),       temp: r => r && r[0].temp },
];

for (const { name, call, temp } of targets) {
  describe(name, () => {
    let service;

    beforeEach(() => {
      now = realNow();
      Date.now = () => now;
      console.error = () => {}; // the service logs every failure, keep the test output clean
      fakeApi();
      service = loadService();
    });

    afterEach(() => {
      Date.now = realNow;
      global.fetch = realFetch;
      console.error = realConsoleError;
    });

    it('5. success with no old data -> returns the new data', async () => {
      assert.strictEqual(temp(await call(service)), '20°');
      assert.strictEqual(api.calls, 1);
    });

    it('A. fresh cache (under 15 min) -> returned without calling the API', async () => {
      await call(service);
      advance(14 * MIN);
      assert.strictEqual(temp(await call(service)), '20°');
      assert.strictEqual(api.calls, 1);
    });

    it('4. success with old data -> old data is replaced', async () => {
      await call(service);
      advance(16 * MIN);
      api.temp = 25;
      assert.strictEqual(temp(await call(service)), '25°');
      assert.strictEqual(api.calls, 2);
    });

    it('1. a call is already pending -> second request shares it, API called once', async () => {
      api.hold();
      const first = call(service);
      const second = call(service);
      api.release();
      const [a, b] = await Promise.all([first, second]);
      assert.strictEqual(temp(a), '20°');
      assert.strictEqual(a, b);
      assert.strictEqual(api.calls, 1);
    });

    it('2. failure with no old data -> null', async () => {
      api.mode = 'fail';
      assert.strictEqual(await call(service), null);
    });

    it('3. failure with old data -> old data', async () => {
      await call(service);
      advance(16 * MIN);
      api.mode = 'fail';
      assert.strictEqual(temp(await call(service)), '20°');
      assert.strictEqual(api.calls, 2);
    });

    it('B. inside the 1 min wait after a failure -> no API call (no old data: null)', async () => {
      api.mode = 'fail';
      await call(service);
      advance(30 * 1000);
      api.mode = 'ok';
      assert.strictEqual(await call(service), null);
      assert.strictEqual(api.calls, 1);
    });

    it('B. inside the 1 min wait after a failure -> no API call (old data: old data)', async () => {
      await call(service);
      advance(16 * MIN);
      api.mode = 'fail';
      await call(service);
      advance(30 * 1000);
      api.mode = 'ok';
      api.temp = 25;
      assert.strictEqual(temp(await call(service)), '20°');
      assert.strictEqual(api.calls, 2);
    });

    it('2 -> ok. recovers after the 1 min wait', async () => {
      api.mode = 'fail';
      assert.strictEqual(await call(service), null);
      advance(61 * 1000);
      api.mode = 'ok';
      assert.strictEqual(temp(await call(service)), '20°');
      assert.strictEqual(api.calls, 2);
    });

    it('recovery clears the failure, so a later failure starts a new wait', async () => {
      api.mode = 'fail';
      await call(service);
      advance(61 * 1000);
      api.mode = 'ok';
      await call(service);                 // recovered
      advance(16 * MIN);
      api.mode = 'fail';
      assert.strictEqual(temp(await call(service)), '20°'); // new failure -> old data
      assert.strictEqual(api.calls, 3);
    });

    it('C. cache for a different location counts as no old data', async () => {
      await call(service, 1, 2);
      api.mode = 'fail';
      assert.strictEqual(await call(service, 3, 4), null);
      assert.strictEqual(api.calls, 2);
    });

    it('D. a pending call that fails -> everyone waiting gets null', async () => {
      api.hold();
      const first = call(service);
      const second = call(service);
      api.mode = 'fail';
      api.release();
      assert.deepStrictEqual(await Promise.all([first, second]), [null, null]);
      assert.strictEqual(api.calls, 1);
    });

    it('E. 200 with a wrong JSON shape -> treated as a failure', async () => {
      api.mode = 'badjson';
      assert.strictEqual(await call(service), null);
      assert.strictEqual(await call(service), null); // and the 1 min wait applies
      assert.strictEqual(api.calls, 1);
    });

    it('F. API never answers -> gives up after the timeout, treated as a failure', async () => {
      api.mode = 'hang';
      const started = realNow();
      assert.strictEqual(await call(service), null);
      const took = realNow() - started;
      assert.ok(took >= 900 && took < 3000, `took ${took}ms`);
      assert.strictEqual(await call(service), null); // and the 1 min wait applies
      assert.strictEqual(api.calls, 1);
    });
  });
}
