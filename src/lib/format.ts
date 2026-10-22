export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact stamp for lists: time today, "YEST", else "DD MMM". */
export function formatStamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return formatClock(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "YEST";
  return date
    .toLocaleDateString(undefined, { day: "2-digit", month: "short" })
    .toUpperCase();
}

/** Long stamp for message rows. */
export function formatFullStamp(iso: string) {
  return new Date(iso)
    .toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
}
