const weatherAPI= require('../services/weatherService'); 
const lat=32.07914764286493;
const lon=34.76857077573147; //a certain place in tel aviv!
const showHome= async (req, res) => {
  const weather=await weatherAPI.getCurrentWeather(process.env.WEATHER_API_KEY,lat,lon);
  const forecast= await weatherAPI.getForecast(process.env.WEATHER_API_KEY,lat,lon);


  res.render('home', { query: req.query,weather,forecast });
};

module.exports = {
  showHome
};
