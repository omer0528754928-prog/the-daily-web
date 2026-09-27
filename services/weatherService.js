const CACHETIME=15*60*1000;
const CRASHWAITTIME=60*1000;
const FETCHTIMEOUT=1000; // give up on the API after 1 second
let cache=null;
let forecastCache=null;
let pendingWeather=null;
let pendingForecast=null;
let weatherFailedAt=null;
let forecastFailedAt=null;
const getCurrentWeather = async (key,lat,lon) => {
  const loc=`${lat},${lon}`;
  // the cache only counts if it's for the same location
  const old=(cache && cache.loc===loc) ? cache.data : null;

  if(old && Date.now()-cache.fetchedAt <= CACHETIME)
    return old;
  // the API failed recently - don't hit it again yet, show the old data (or nothing)
  if(weatherFailedAt && Date.now()-weatherFailedAt < CRASHWAITTIME)
    return old;
  if(pendingWeather)
    return pendingWeather;

  pendingWeather=(async ()=>{
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lang=he&lat=${lat}&lon=${lon}&appid=${key}&units=metric`, { signal: AbortSignal.timeout(FETCHTIMEOUT) });

        if (!res.ok) {
            throw new Error(`HTTP ERROR ${res.status}`);
        }
        const data=await res.json();
         const output={city: data.name,temp: String(Math.round(data.main.temp))+'°',condition: [data.weather[0].main,data.weather[0].description]
                         ,humidity: String(data.main.humidity)+'%',icon: data.weather[0].icon}

        cache={data:output,loc,fetchedAt:Date.now()}
        weatherFailedAt=null;
        return output;

    } catch (error) {
      console.error(error);
      weatherFailedAt=Date.now();
      return old;//we prefer to show data that is old than no data
    } finally {
      pendingWeather=null;
    }
  })();
  return pendingWeather;
};

const getForecast = async (key, lat, lon) => {
  const loc = `${lat},${lon}`;
  const old = (forecastCache && forecastCache.loc === loc) ? forecastCache.data : null;

  if (old && Date.now() - forecastCache.fetchedAt <= CACHETIME) {
    return old;
  }
  // the API failed recently - don't hit it again yet
  if (forecastFailedAt && Date.now() - forecastFailedAt < CRASHWAITTIME) {
    return old;
  }

  if (pendingForecast) {
    return pendingForecast;
  }

  pendingForecast = (async () => {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lang=he&lat=${lat}&lon=${lon}&appid=${key}&units=metric`, { signal: AbortSignal.timeout(FETCHTIMEOUT) });
      if (!res.ok) throw new Error(`HTTP ERROR ${res.status}`);

      const data = await res.json();
      const offsetMs = data.city.timezone * 1000; // seconds -> ms, this location's UTC offset

      const byDate = new Map(); // "YYYY-MM-DD" (local) -> closest-to-noon entry so far

      for (const item of data.list) {
        const local = new Date(item.dt * 1000 + offsetMs);
        const dateKey = local.toISOString().slice(0, 10);
        const hourDistanceFromNoon = Math.abs(local.getUTCHours() - 12);

        const current = byDate.get(dateKey);
        if (!current || hourDistanceFromNoon < current.hourDistanceFromNoon) {
          byDate.set(dateKey, { item, local, hourDistanceFromNoon });
        }
      }

      const todayKey = new Date(Date.now() + offsetMs).toISOString().slice(0, 10);

      const forecast = [...byDate.entries()]
        .filter(([dateKey]) => dateKey !== todayKey)
        .slice(0, 4)
        .map(([, { item, local }]) => ({
          day: local.toLocaleDateString('he-IL', { weekday: 'long', timeZone: 'UTC' }).replace(/יום /, ""),
          temp: String(Math.round(item.main.temp))+'°',
        }));

      forecastCache = { data: forecast, loc, fetchedAt: Date.now() };
      forecastFailedAt = null;
      return forecast;
    } catch (error) {
      console.error(error);
      forecastFailedAt = Date.now();
      return old;
    } finally {
      pendingForecast = null;
    }
  })();

  return pendingForecast;
};

module.exports={getCurrentWeather,getForecast};