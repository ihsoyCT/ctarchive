// Same output as moment's "llll" in the en locale: "Thu, Sep 4, 1986 8:30 PM",
// in the viewer's local time zone.
const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short", month: "short", day: "numeric", year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric", minute: "2-digit",
});

/**
 * Format a unix timestamp (seconds) for display.
 * @param {number} unixSeconds
 * @returns {string}
 */
export function formatTime(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return `${dateFormat.format(date)} ${timeFormat.format(date)}`;
}
