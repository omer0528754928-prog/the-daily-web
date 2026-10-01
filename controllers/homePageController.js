const weatherAPI= require('../services/weatherService');
const {listPopular, listFeed}= require('../services/feedService');
const {toFeedCard}=require('../presenters/feedArticlePresenter');
const lat=32.07914764286493;
const lon=34.76857077573147; //a certain place in tel aviv!

// Current weather and forecast for a place, fetched together
const callPromisesWeatherAPI= async (lat,lon)=>{
  const key = process.env.WEATHER_API_KEY;
  if(!key)
    return {weather:null, forecast:null};

  const [weather, forecast] = await Promise.all([
    weatherAPI.getCurrentWeather(key, lat, lon),
    weatherAPI.getForecast(key, lat, lon),
  ]);
  return {weather,forecast};
};

const showHome= async (req, res,next) => {
  try{
    const [weatherOutput,feed,popular,ticker]= await Promise.all([
       callPromisesWeatherAPI(lat,lon),
       listFeed({filters:req.filters,sort:req.sort,limit:20}),
       listPopular(5),
       listFeed({ limit: 4 }).then(({ items }) => items.map(toFeedCard))
    ]);
    const {weather,forecast}=weatherOutput;
    const feedCards=feed.items.map(toFeedCard);
    const popularCards=popular.map(toFeedCard);
    res.render('home', { query: req.query,weather,forecast,popular:popularCards,articles:feedCards,hasMore:feed.hasMore,ticker });
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
