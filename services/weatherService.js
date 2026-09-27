const CACHETIME=15*60*1000;
let cache=null;
let forecastCache=null;
let pendingWeather=null;
let pendingForcast=null;
const getCurrentWeather = async (key,lat,lon) => {
  if(pendingWeather)
    return pendingWeather;
  if(cache && Date.now()-cache.fetchedAt <= CACHETIME )
    {
      // console.log("cached");
      return cache.data;
    }
  else{
    try {
        // console.log("fetching");
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`);

        if (!res.ok) {
            throw new Error(`HTTP ERROR ${res.status}`);
        }
        pendingWeather=res;
        const data=await res.json();
         const output={city: data.name,temp: Math.round(data.main.temp),condition: [data.weather[0].main,data.weather[0].description]
                         ,humidity:data.main.humidity}
        // console.log(output);
        
        cache={data:output,fetchedAt:Date.now(),pendingWeather}
        return output;

    } catch (error) {
        console.error(error);
        return null;
    }
    }
};

const getForecast = async (key, lat, lon) => {
  if (forecastCache && Date.now() - forecastCache.fetchedAt <= CACHETIME) {
    // console.log("cached");
    return forecastCache.data;
  }

  try {
    // console.log("fetching");
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric`);
    if (!res.ok) throw new Error(`HTTP ERROR ${res.status}`);
    pendingForcast=res;
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
        temp: Math.round(item.main.temp),
      }));

    forecastCache = { data: forecast, fetchedAt: Date.now(),pendingForcast };
    return forecast;
  } catch (error) {
    console.error(error);
    return null;
  }
};

module.exports={getCurrentWeather,getForecast};