const TIME_ZONE = 'Asia/Jerusalem';
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const weekdayFormatter = new Intl.DateTimeFormat('he-IL', { timeZone: TIME_ZONE, weekday: 'long' });

function getParts(date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map(p => [p.type, p.value]));
  return { ...parts, dayKey: `${parts.year}-${parts.month}-${parts.day}` };
}

// "10.09.2026, 07:45"
function formatDateTime(date) {
  if (!date) return '—';
  const p = getParts(new Date(date));
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}

// "לפני 3 דקות", "לפני שעה", "אתמול, 18:20", "שלישי, 08:10", or the full date
function formatRelative(date, now = new Date()) {
  if (!date) return '—';
  const target = new Date(date);
  const diff = now - target;
  const p = getParts(target);
  const time = `${p.hour}:${p.minute}`;

  if (diff < 0) return formatDateTime(target);
  if (diff < MINUTE) return 'עכשיו';
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return minutes === 1 ? 'לפני דקה' : `לפני ${minutes} דקות`;
  }

  const isToday = p.dayKey === getParts(now).dayKey;
  if (isToday) {
    const hours = Math.floor(diff / HOUR);
    if (hours === 1) return 'לפני שעה';
    if (hours === 2) return 'לפני שעתיים';
    return `לפני ${hours} שעות`;
  }

  if (p.dayKey === getParts(new Date(now - DAY)).dayKey) return `אתמול, ${time}`;
  if (diff < 7 * DAY) return `${weekdayFormatter.format(target).replace('יום ', '')}, ${time}`;
  return formatDateTime(target);
}

module.exports = { formatDateTime, formatRelative };
