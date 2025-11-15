export function timestamp(when: "today_ending" | "plus_one_hour" | "tommorow_ending"): number {
  switch (when) {
    case "today_ending":
      return Math.round(Date.now() / 1000) + (23 - new Date().getHours()) * 3600;
    case "tommorow_ending":
      return Math.round(Date.now() / 1000) + (47 - new Date().getHours()) * 3600;
    case "plus_one_hour":
      return Math.round(Date.now() / 1000) + 3600;
    default:
      return Math.round(Date.now() / 1000);
  }
}

export function timestampToDateString(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
}

export function timestampToDateTimeString(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function humanizeDuration(durationMs: number): string {
  // Handle non-positive durations
  if (durationMs <= 0) {
    return "0с";
  }

  // Define time constants in milliseconds
  const msPerSecond = 1000;
  const msPerMinute = 60 * msPerSecond;
  const msPerHour = 60 * msPerMinute;
  const msPerDay = 24 * msPerHour;
  const msPerYear = 365 * msPerDay; // Approximation, ignores leap years

  let remainingMs = durationMs;
  const parts: string[] = [];

  // Calculate years
  const years = Math.floor(remainingMs / msPerYear);
  if (years > 0) {
    parts.push(`${years}л`);
    remainingMs %= msPerYear;
  }

  // Calculate days
  const days = Math.floor(remainingMs / msPerDay);
  if (days > 0) {
    parts.push(`${days}д`);
    remainingMs %= msPerDay;
  }

  // Calculate hours
  const hours = Math.floor(remainingMs / msPerHour);
  if (hours > 0) {
    parts.push(`${hours}ч`);
    remainingMs %= msPerHour;
  }

  // Calculate minutes
  const minutes = Math.floor(remainingMs / msPerMinute);
  if (minutes > 0) {
    parts.push(`${minutes}м`);
    remainingMs %= msPerMinute;
  }

  const seconds = Math.floor(remainingMs / msPerSecond);
  if (seconds > 0) {
    parts.push(`${seconds}с`);
  }

  if (parts.length === 0) {
    return "0с";
  }

  return parts.join(" ");
}

export function stringDate(): string {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
}
