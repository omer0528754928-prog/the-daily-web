// Keeps the weather widget (home page or article page) up to date without reloading the page:
// when the server's cached weather expires, asks the server for the widget HTML again and swaps it in.
// The widget's data-fetched-at says when the shown weather was fetched, everything is timed from it.

const REFRESH_MS = 14.5 * 60 * 1000; // the server caches the weather for 14.5 minutes
const MARGIN_MS = 5 * 1000;          // refresh a bit after the server cache expires, not right on it
const MIN_DELAY_MS = 60 * 1000;      // never refresh more than once a minute (API down / no data)
// same as the "no weather" state of views/partials/weatherWidgetBig.ejs and weatherWidgetSmall.ejs
const UNAVAILABLE_INNER_HTML = '<div class="weather__main"><div>'
    + '<div class="weather__city">מזג אוויר</div><div class="weather__desc">מזג האוויר אינו זמין כרגע</div>'
    + '</div></div><div class="weather__source">מתעדכן מ־OpenWeatherMap</div>';
let timerID = null; // the next scheduled refresh (there is only ever one)
let refreshing = false; // a refresh request is in progress

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
    // a hidden tab doesn't need fresh weather (it is refreshed when the tab is shown again)
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
            // outerHTML replaces the whole <section>, including its data-fetched-at, with the server's new one
            widget.outerHTML = await res.text();
            return;
        }
        console.warn(`HTTP ERROR ${res.status}`);
    } catch (error) {
        console.error(error);
    }
    // the request failed (error status or no network)
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
    // time left until the data expires on the server (plus the margin); NaN when fetchedAt is unknown
    const delay = fetchedAt + REFRESH_MS + MARGIN_MS - Date.now();

    clearTimeout(timerID); // only one timer at a time
    // no weather on the page: try again in a minute
    if (Number.isNaN(delay)) {
        timerID = setTimeout(refreshReschedule, MIN_DELAY_MS);
        return;
    }
    // Math.max: if the server sent data that is already old (or the refresh failed), the delay is
    // 0 or negative - wait at least a minute instead of asking again right away, over and over
    timerID = setTimeout(refreshReschedule, Math.max(delay, MIN_DELAY_MS));
};

// One step of the refresh loop: refresh the widget, then schedule the next step.
// setTimeout (not setInterval) so each wait is computed from the data the server just sent.
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
        refreshing = false; // finally: unlock even if the refresh threw
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

// page loaded: start the loop
scheduleNext();
