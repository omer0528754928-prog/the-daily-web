const REFRESH_MS = 15 * 60 * 1000; // the server caches the weather for 15 minutes
const MARGIN_MS = 5 * 1000;        // refresh a bit after the server cache expires, not right on it
const MIN_DELAY_MS = 60 * 1000;    // never refresh more than once a minute (API down / no data)
let timerID = null;
let refreshing = false;

// Fetches the widget HTML from the server and swaps it in. On any failure the old widget stays.
const refreshWeather = async () => {
    if (document.hidden) {
        return;
    }
    try {
        const widget = document.querySelector('.widget.weather');
        if (!widget) {
            return;
        }

        const res = await fetch('/weather-widget');
        if (!res.ok) {
            console.warn(`HTTP ERROR ${res.status}`);
            return;
        }

        widget.outerHTML = await res.text();
    } catch (error) {
        console.error(error);
    }
};

// When the weather on the page was fetched by the server (NaN if unknown)
const getFetchedAt = () => {
    const widget = document.querySelector('.widget.weather');
    if (!widget) {
        return NaN;
    }
    return Number(widget.dataset.fetchedAt);
};

// Schedules the next refresh for when the server's cached data expires
const scheduleNext = () => {
    const fetchedAt = getFetchedAt();
    const delay = fetchedAt + REFRESH_MS + MARGIN_MS - Date.now();

    clearTimeout(timerID);
    if (Number.isNaN(delay)) {
        timerID = setTimeout(refreshReschedule, MIN_DELAY_MS);
        return;
    }
    timerID = setTimeout(refreshReschedule, Math.max(delay, MIN_DELAY_MS));
};

const refreshReschedule = async () => {
    clearTimeout(timerID); // a refresh starts now - cancel the one that was waiting
    // hidden: stop the chain, the visibilitychange listener starts it again.
    // already refreshing: that refresh will schedule the next one.
    if (document.hidden || refreshing) {
        return;
    }
    refreshing = true;
    try {
        await refreshWeather();
    } finally {
        refreshing = false;
    }
    scheduleNext();
};

// Coming back to the tab: refresh right away if the data expired while the tab was hidden,
// otherwise start the timer again (it was stopped while the tab was hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        return;
    }
    const fetchedAt = getFetchedAt();
    if (Number.isNaN(fetchedAt) || Date.now() >= fetchedAt + REFRESH_MS) {
        refreshReschedule();
    } else {
        scheduleNext();
    }
});

scheduleNext();
