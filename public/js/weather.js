const REFRESH_MS = 14.5 * 60 * 1000; // the server caches the weather for 14.5 minutes
const MARGIN_MS = 5 * 1000;          // refresh a bit after the server cache expires, not right on it
const MIN_DELAY_MS = 60 * 1000;      // never refresh more than once a minute (API down / no data)
// same as the "no weather" state of views/partials/weatherWidgetBig.ejs and weatherWidgetSmall.ejs
const UNAVAILABLE_INNER_HTML = '<div class="weather__main"><div>'
    + '<div class="weather__city">מזג אוויר</div><div class="weather__desc">מזג האוויר אינו זמין כרגע</div>'
    + '</div></div><div class="weather__source">מתעדכן מ־OpenWeatherMap</div>';
let timerID = null;
let refreshing = false;

// When the shown weather is past the server cache time it must not stay on the page
const isExpired = (fetchedAt) => Date.now() >= fetchedAt + REFRESH_MS;

// The big widget (home page) refreshes from /weather-widget, the small one says where on data-refresh-url
const refreshUrlOf = (widget) => widget.dataset.refreshUrl || '/weather-widget';

// "Unavailable" in the same kind of widget (same class and refresh url), without data-fetched-at
const unavailableHtml = (widget) => {
    const refreshUrl = widget.dataset.refreshUrl ? ` data-refresh-url="${widget.dataset.refreshUrl}"` : '';
    return `<section class="${widget.className}"${refreshUrl}>${UNAVAILABLE_INNER_HTML}</section>`;
};

// Fetches the widget HTML from the server and swaps it in.
// On a failure the old widget stays only while its data is still fresh, otherwise it says "unavailable".
const refreshWeather = async () => {
    if (document.hidden) {
        return;
    }
    const widget = document.querySelector('.widget.weather');
    if (!widget) {
        return;
    }
    try {
        const res = await fetch(refreshUrlOf(widget));
        if (res.ok) {
            widget.outerHTML = await res.text();
            return;
        }
        console.warn(`HTTP ERROR ${res.status}`);
    } catch (error) {
        console.error(error);
    }
    if (isExpired(Number(widget.dataset.fetchedAt))) {
        widget.outerHTML = unavailableHtml(widget);
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
    if (Number.isNaN(fetchedAt) || isExpired(fetchedAt)) {
        refreshReschedule();
    } else {
        scheduleNext();
    }
});

scheduleNext();
