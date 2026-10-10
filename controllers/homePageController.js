const weatherAPI= require('../services/weatherService');
const {listPopular, listFeed}= require('../services/feedService');
const {toFeedCard}=require('../presenters/feedArticlePresenter');

// GET / : the home page. req.filters and req.sort come from middleware/feedFilters.js
const showHome= async (req, res,next) => {
  try{
    // The read list is only in the browser's localStorage, so the server can't build the "unseen" feed.
    // It sends an empty grid and feed.js loads the first batch with the list.
    const unseenOnly = req.filters.view === 'unseen';
    // Everything the page needs is loaded at the same time instead of one after the other
    const [weatherOutput,feed,popular,ticker]= await Promise.all([
       weatherAPI.getLocalWeather(),
       // the first batch of the feed; feed.js loads the rest from /api/feed while scrolling
       unseenOnly
         ? { items: [], hasMore: true } // no query, feed.js fills it
         : listFeed({ filters: req.filters, sort: req.sort, limit: 20 }),
       listPopular(5),
       // the ticker always shows the 4 newest articles, whatever the filters are
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

// GET /weather-widget : only the big widget's HTML (home page sidebar), for public/js/weather.js to swap in
const weatherWidget = async (req, res, next) => {
  try {
    const {weather,forecast} = await weatherAPI.getLocalWeather();
    // no weather -> the partial shows "weather unavailable" instead of the client keeping old data
    res.render('partials/weatherWidgetBig', { weather, forecast });
  } catch (error) { next(error); }
};

// GET /weather-widget/small : the small widget (article page sidebar): current weather only, no forecast
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
