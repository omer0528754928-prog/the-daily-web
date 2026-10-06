// Gets the weather from OpenWeatherMap and keeps it in memory, so every page view doesn't call the API.
// Current weather and forecast each have their own cache, failure time and pending call.

const CACHETIME=14.5*60*1000; // keep it under 15 minutes
const CRASHWAITTIME=60*1000; // after a failed call, wait a minute before trying the API again
const FETCHTIMEOUT=2500; // give up on the API after 2.5 seconds
let cache=null; // last current weather: { data, loc, fetchedAt }
let forecastCache=null; // last forecast: { data, loc, fetchedAt }
let pendingWeather=null; // the API call in progress (a promise), so requests at the same time share it
let pendingForecast=null;
let weatherFailedAt=null; // when the last call failed (null = the last call worked)
let forecastFailedAt=null;

// The current weather at (lat, lon), from the cache when it is fresh, otherwise from the API.
// Never throws: returns null when the API fails or failed less than a minute ago.
const getCurrentWeather = async (key,lat,lon) => {
  const loc=`${lat},${lon}`;
  // the cache only counts if it's for the same location
  const old=(cache && cache.loc===loc) ? cache.data : null;

  if(old && Date.now()-cache.fetchedAt <= CACHETIME)
    return old;
  // the API failed recently - don't hit it again yet. old data is expired here, so show nothing
  if(weatherFailedAt && Date.now()-weatherFailedAt < CRASHWAITTIME)
    return null;
  // a call is already on its way - wait for it instead of sending a second one
  if(pendingWeather)
    return pendingWeather;

  // Start the call and save its promise right away (before awaiting anything),
  // so a request that comes in a moment later finds it in pendingWeather
  pendingWeather=(async ()=>{
    try {
        // AbortSignal.timeout cancels the fetch after FETCHTIMEOUT and makes it throw a TimeoutError
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lang=he&lat=${lat}&lon=${lon}&appid=${key}&units=metric`, { signal: AbortSignal.timeout(FETCHTIMEOUT) });

        if (!res.ok) {
            throw new Error(`HTTP ERROR ${res.status}`);
        }
        const data=await res.json();
        const fetchedAt = Date.now();
         // Only what the widgets show, already formatted. condition = [English group, Hebrew description].
         // If the JSON has the wrong shape this throws and is handled like any other failure.
         const output={city: data.name,temp: String(Math.round(data.main.temp))+'°',condition: [data.weather[0].main,data.weather[0].description]
                         ,humidity: String(data.main.humidity)+'%',icon: data.weather[0].icon,fetchedAt}

        cache={data:output,loc,fetchedAt}
        weatherFailedAt=null;
        return output;

    } catch (error) {
      if (error.name === 'TimeoutError') {
        console.warn('Weather API timed out');
      } else {
        console.error(error);
      }

      weatherFailedAt=Date.now();
      return null;//expired data is not shown - the widget says the weather is unavailable
    } finally {
      // the call is over (worked or failed), the next request may start a new one
      pendingWeather=null;
    }
  })();
  return pendingWeather;
};

// The next 4 days (without today) at (lat, lon): [{ day: 'ראשון', temp: '25°' }, ...].
// Same cache / failure / pending rules as getCurrentWeather.
const getForecast = async (key, lat, lon) => {
  const loc = `${lat},${lon}`;
  const old = (forecastCache && forecastCache.loc === loc) ? forecastCache.data : null;

  if (old && Date.now() - forecastCache.fetchedAt <= CACHETIME) {
    return old;
  }
  // the API failed recently - don't hit it again yet. old data is expired here, so show nothing
  if (forecastFailedAt && Date.now() - forecastFailedAt < CRASHWAITTIME) {
    return null;
  }

  // a call is already on its way - wait for it instead of sending a second one
  if (pendingForecast) {
    return pendingForecast;
  }

  pendingForecast = (async () => {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lang=he&lat=${lat}&lon=${lon}&appid=${key}&units=metric`, { signal: AbortSignal.timeout(FETCHTIMEOUT) });
      if (!res.ok) throw new Error(`HTTP ERROR ${res.status}`);

      const data = await res.json();
      const offsetMs = data.city.timezone * 1000; // seconds -> ms, this location's UTC offset

      // The API gives an entry every 3 hours for 5 days. We want one per day: the one closest to noon.
      const byDate = new Map(); // "YYYY-MM-DD" (local) -> closest-to-noon entry so far

      for (const item of data.list) {
        // Shift the UTC time by the location's offset, then read it with the UTC getters:
        // that gives the local date and hour there, whatever time zone this server runs in
        const local = new Date(item.dt * 1000 + offsetMs);
        const dateKey = local.toISOString().slice(0, 10);
        const hourDistanceFromNoon = Math.abs(local.getUTCHours() - 12);

        const current = byDate.get(dateKey);
        if (!current || hourDistanceFromNoon < current.hourDistanceFromNoon) {
          byDate.set(dateKey, { item, local, hourDistanceFromNoon });
        }
      }

      // today's date at the location, the same way (the widget already shows today's weather)
      const todayKey = new Date(Date.now() + offsetMs).toISOString().slice(0, 10);

      // A Map keeps insertion order, and the API list is sorted by time, so the days are in order
      const forecast = [...byDate.entries()]
        .filter(([dateKey]) => dateKey !== todayKey)
        .slice(0, 4)
        .map(([, { item, local }]) => ({
          // timeZone: 'UTC' because `local` is already shifted; "יום ראשון" -> "ראשון"
          day: local.toLocaleDateString('he-IL', { weekday: 'long', timeZone: 'UTC' }).replace(/יום /, ""),
          temp: String(Math.round(item.main.temp))+'°'
        }));

      forecastCache = { data: forecast, loc, fetchedAt: Date.now() };
      forecastFailedAt = null;
      return forecast;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        console.warn('Weather API timed out');
      } else {
        console.error(error);
      }
      forecastFailedAt = Date.now();
      return null; // expired data is not shown
    } finally {
      // the call is over (worked or failed), the next request may start a new one
      pendingForecast = null;
    }
  })();

  return pendingForecast;
};

const LAT=32.07914764286493;
const LON=34.76857077573147; //a certain place in tel aviv!

// The site's weather: the current weather, plus the forecast unless withForecast is false.
// No API key -> nothing, the widgets say the weather is unavailable
const getLocalWeather = async ({withForecast=true}={}) => {
  const key = process.env.WEATHER_API_KEY;
  if(!key)
    return {weather:null, forecast:null};

  // both calls run at the same time; neither throws, so one failing doesn't hide the other
  const [weather, forecast] = await Promise.all([
    getCurrentWeather(key, LAT, LON),
    withForecast ? getForecast(key, LAT, LON) : null,
  ]);
  return {weather,forecast};
};

module.exports={getCurrentWeather,getForecast,getLocalWeather};
