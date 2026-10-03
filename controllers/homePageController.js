const weatherAPI= require('../services/weatherService');
const {listPopular, listFeed}= require('../services/feedService');
const {toFeedCard}=require('../presenters/feedArticlePresenter');

const showHome= async (req, res,next) => {
  try{
    const [weatherOutput,feed,popular,ticker]= await Promise.all([
       weatherAPI.getLocalWeather(),
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
    const {weather,forecast} = await weatherAPI.getLocalWeather();
    // no weather -> the partial shows "weather unavailable" instead of the client keeping old data
    res.render('partials/weatherWidgetBig', { weather, forecast });
  } catch (error) { next(error); }
};

// The small widget (article page sidebar): current weather only, no forecast
const weatherWidgetSmall = async (req, res, next) => {
  try {
    const {weather} = await weatherAPI.getLocalWeather({withForecast:false});
    res.render('partials/weatherWidgetSmall', { weather });
  } catch (error) { next(error); }
};

module.exports = {
  weatherWidget,
  weatherWidgetSmall,
  showHome
};
