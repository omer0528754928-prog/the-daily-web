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

module.exports = {
  showHome
};
