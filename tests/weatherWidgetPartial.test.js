// Renders views/partials/weatherWidgetBig.ejs (and the home page that includes it) with EJS directly,
// the same way res.render does, to check what the widget HTML looks like with and without weather data.
// Run with: npm test

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const ejs = require('ejs');

const VIEWS = path.join(__dirname, '../views');
const PARTIAL = path.join(VIEWS, 'partials/weatherWidgetBig.ejs');
const HOME = path.join(VIEWS, 'home.ejs');

const render = (file, data) => ejs.renderFile(file, data);

// TODO (known gap): the two time-zone tests only catch a missing `timeZone: 'Asia/Jerusalem'` when the machine
// running them is NOT on Israel time. On a dev machine in Israel they pass even without it (it was checked with TZ=UTC).
// Possible fix: set process.env.TZ = 'UTC' at the top of this file, before any date is formatted.

const SUMMER_FETCH =Date.UTC(2026, 8, 28, 11, 30); // 11:30 UTC = 14:30 in Israel (summer time, UTC+3)
const WINTER_FETCH = Date.UTC(2026, 11, 1, 11, 30); // 11:30 UTC = 13:30 in Israel (winter time, UTC+2)

const weatherData = (overrides = {}) => ({
  city: 'תל אביב-יפו',
  temp: '24°',
  condition: ['Clear', 'שמיים בהירים'],
  humidity: '60%',
  icon: '01d',
  fetchedAt: SUMMER_FETCH,
  ...overrides,
});

const forecastData = [
  { day: 'ראשון', temp: '25°' },
  { day: 'שני', temp: '27°' },
];

describe('weather widget partial', () => {
  describe('with weather', () => {
    it('shows the current weather', async () => {
      const html = await render(PARTIAL, { weather: weatherData(), forecast: null });
      assert.match(html, /מזג אוויר · תל אביב-יפו/);
      assert.match(html, /24°/);
      assert.match(html, /שמיים בהירים · לחות 60%/);
      assert.match(html, /openweathermap\.org\/img\/wn\/01d@4x\.png/);
    });

    it('puts fetchedAt on the <section> tag, where weather.js reads it', async () => {
      const html = await render(PARTIAL, { weather: weatherData(), forecast: null });
      assert.match(html, new RegExp(`^<section class="widget weather" data-fetched-at="${SUMMER_FETCH}">`));
    });

    it('shows when the data was fetched, in Israel time, after "עודכן ב־"', async () => {
      const html = await render(PARTIAL, { weather: weatherData(), forecast: null });
      assert.match(html, /מתעדכן מ־OpenWeatherMap · עודכן ב־14:30/);
    });

    it('uses Israel winter time too (not the server time zone)', async () => {
      const html = await render(PARTIAL, { weather: weatherData({ fetchedAt: WINTER_FETCH }), forecast: null });
      assert.match(html, /עודכן ב־13:30/);
    });

    it('escapes the data from the API', async () => {
      const html = await render(PARTIAL, { weather: weatherData({ city: '<script>alert(1)</script>' }), forecast: null });
      assert.doesNotMatch(html, /<script>/);
      assert.match(html, /&lt;script&gt;/);
    });
  });

  describe('without weather (API down, nothing cached)', () => {
    it('renders without crashing and says the weather is unavailable', async () => {
      const html = await render(PARTIAL, { weather: null, forecast: null });
      assert.match(html, /מזג האוויר אינו זמין כרגע/);
    });

    it('has no data-fetched-at and no "updated at" time', async () => {
      const html = await render(PARTIAL, { weather: null, forecast: null });
      assert.match(html, /^<section class="widget weather">/);
      assert.doesNotMatch(html, /data-fetched-at/);
      assert.doesNotMatch(html, /עודכן ב/);
      assert.match(html, /מתעדכן מ־OpenWeatherMap<\/div>/);
    });
  });

  describe('forecast', () => {
    it('shows one entry per day', async () => {
      const html = await render(PARTIAL, { weather: weatherData(), forecast: forecastData });
      assert.match(html, /weather__forecast/);
      assert.match(html, /<span>ראשון<\/span>\s*<strong>25°<\/strong>/);
      assert.match(html, /<span>שני<\/span>\s*<strong>27°<\/strong>/);
    });

    it('is left out when there is no forecast', async () => {
      for (const forecast of [null, []]) {
        const html = await render(PARTIAL, { weather: weatherData(), forecast });
        assert.doesNotMatch(html, /weather__forecast/);
      }
    });

    it('still shows when only the current weather is missing', async () => {
      const html = await render(PARTIAL, { weather: null, forecast: forecastData });
      assert.match(html, /מזג האוויר אינו זמין כרגע/);
      assert.match(html, /weather__forecast/);
    });
  });

  describe('home page', () => {
    const homeData = (weather) => ({ weather, forecast: null, query: {}, categories: ['חדשות'] });

    it('renders with the widget and loads weather.js', async () => {
      const html = await render(HOME, homeData(weatherData()));
      assert.match(html, /data-fetched-at="\d+"/);
      assert.match(html, /<script src="\/js\/weather\.js" defer><\/script>/);
    });

    it('still renders when there is no weather (the page must not fail because of the widget)', async () => {
      const html = await render(HOME, homeData(null));
      assert.match(html, /מזג האוויר אינו זמין כרגע/);
    });
  });
});
