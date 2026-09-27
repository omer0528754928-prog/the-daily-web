const REFRESH_MS=15*60*1000;
let lastRefresh=Date.now();

const refreshWeather=async ()=>{
    if(document.hidden){
        return;
    }
    try{
    const widget = document.querySelector(".widget.weather");
    
    if(!widget){
        return;
    }
    const res= await fetch('/weather-widget');

    
    if (!res.ok) {
        console.warn(Error(`HTTP ERROR ${res.status}`));
        return;
    }
    //Number(widget.dataset.fetchedAt);
    const newWidget=await res.text();
    widget.outerHTML=newWidget;
    lastRefresh=Date.now();
    

}catch(error)
    {
        console.error(error);
    }
};
document.addEventListener('visibilitychange',()=>{
     if (document.hidden) return;
    if(Date.now()-lastRefresh>=REFRESH_MS){
        refreshWeather();
    }
});
setInterval(refreshWeather,REFRESH_MS);


scheduleNext()