export function timestamp(when: "today_ending" | "plus_one_hour"): number {
  switch (when) {
    case "today_ending":
      return Math.round(Date.now() / 1000) + (23 - new Date().getHours()) * 3600;
    case "plus_one_hour":
      return Math.round(Date.now() / 1000) + 3600;
    default:
      return Math.round(Date.now() / 1000);
  }
}
