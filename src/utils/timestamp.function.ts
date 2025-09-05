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
