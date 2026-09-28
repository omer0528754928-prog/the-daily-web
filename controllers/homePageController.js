const weatherAPI= require('../services/weatherService');

const lat=32.07914764286493;
const lon=34.76857077573147; //a certain place in tel aviv!

// Current weather and forecast for a place, fetched together
const callPromisesWeatherAPI= async (lat,lon)=>{
  const key = process.env.WEATHER_API_KEY;
  const [weather, forecast] = await Promise.all([
    weatherAPI.getCurrentWeather(key, lat, lon),
    weatherAPI.getForecast(key, lat, lon),
  ]);
  return {weather,forecast};
};

const showHome= async (req, res,next) => {
  try{
    const {weather,forecast} = await callPromisesWeatherAPI(lat,lon);
    res.render('home', { query: req.query,weather,forecast });
  }
  catch(error){
    console.error(error);
    next(error);
  }
};

const weatherWidget = async (req, res, next) => {
  try {
    const {weather,forecast} = await callPromisesWeatherAPI(lat,lon);
    if (!weather) return res.sendStatus(503);   // let the client keep what it has
    res.render('partials/weatherWidgetBig', { weather, forecast });
  } catch (error) { next(error); }
};

module.exports = {
  weatherWidget,
  showHome
};
