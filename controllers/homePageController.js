const weatherAPI= require('../services/weatherService'); 

const lat=32.07914764286493;
const lon=34.76857077573147; //a certain place in tel aviv!

const showHome= async (req, res,next) => {
  try{

    const key = process.env.WEATHER_API_KEY;
    const [weather, forecast] = await Promise.all([
    weatherAPI.getCurrentWeather(key, lat, lon),
    weatherAPI.getForecast(key, lat, lon),
  ]);

  res.render('home', { query: req.query,weather,forecast });
  }
  catch(error){
    console.error(error);
    next(error);
  }
};

// Development only: /dev/weather?place=... makes /weather-widget answer for another place (or fail),
// so the client refresh can be checked by hand. The home page itself always shows Tel Aviv.
const DEV_PLACES = {
  moscow: { lat: 55.7558, lon: 37.6173 },
  london: { lat: 51.5072, lon: -0.1276 },
  newyork: { lat: 40.7128, lon: -74.006 },
};
let devWeather = null; // null = normal, a place from DEV_PLACES, or 'down'

const setDevWeather = (req, res) => {
  const place = req.query.place;
  if (!place || place === 'reset') devWeather = null;
  else if (place === 'down') devWeather = 'down';
  else if (DEV_PLACES[place]) devWeather = DEV_PLACES[place];
  else return res.status(400).send(`Unknown place. Use one of: ${Object.keys(DEV_PLACES).join(', ')}, down, reset`);

  res.send(`/weather-widget now answers for: ${place || 'reset'} (Tel Aviv when reset)`);
};

const weatherWidget = async (req, res, next) => {
  try {
    if (devWeather === 'down') return res.sendStatus(503);
    const place = devWeather || { lat, lon };

    const key = process.env.WEATHER_API_KEY;
    const [weather, forecast] = await Promise.all([
      weatherAPI.getCurrentWeather(key, place.lat, place.lon),
      weatherAPI.getForecast(key, place.lat, place.lon),
    ]);
    if (!weather) return res.sendStatus(503);   // let the client keep what it has
    res.render('partials/weatherWidgetBig', { weather, forecast });
  } catch (error) { next(error); }
};
module.exports = {
  setDevWeather,
  weatherWidget,
  showHome
};
