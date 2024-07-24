import EventSource from "eventsource";
import { inspect } from "node:util";

const COLORS = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  Underscore: "\x1b[4m",
  Blink: "\x1b[5m",
  Reverse: "\x1b[7m",
  Hidden: "\x1b[8m",

  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",
  FgGray: "\x1b[90m",

  BgBlack: "\x1b[40m",
  BgRed: "\x1b[41m",
  BgGreen: "\x1b[42m",
  BgYellow: "\x1b[43m",
  BgBlue: "\x1b[44m",
  BgMagenta: "\x1b[45m",
  BgCyan: "\x1b[46m",
  BgWhite: "\x1b[47m",
  BgGray: "\x1b[100m",
};

let file, host;

for (const item of process.argv) {
  if (item.startsWith("--file=")) {
    file = item.replace("--file=", "?file=");
  }
  if (item.startsWith("--host=")) {
    host = item.replace("--host=", "");
  }
}

if (!host || host === "") {
  console.error("No host specified");
  process.exit(1);
}

console.log("Connecting to:", `${host}/log_viewer/tail${file ?? ""}`);

const source = new EventSource(`${host}/log_viewer/tail${file ?? ""}`, {
  https: { rejectUnauthorized: false },
});

source.onmessage = (ev) => {
  try {
    const data = JSON.parse(ev.data);
    console.log(
      `${data.timestamp} %s${data.level.toUpperCase()}%s [%s${data.context}%s] ${data.message ? data.message : ""}`,
      level(data.level),
      COLORS.Reset,
      COLORS.FgGreen,
      COLORS.Reset,
    );
    if (data.data) {
      console.log(inspect(data.data, false, null, true));
    }
    if (data.stack) {
      console.log(inspect(data.stack, false, null, true));
    }
  } catch (err) {
    console.error("JSON.parse error", ev.data, err);
    return;
  }
};

source.onerror = (err) => {
  console.error("Host closed connection", err);
  process.exit(1);
};

function level(level) {
  switch (level) {
    case "info":
      return COLORS.FgYellow;
    case "warn":
      return COLORS.FgMagenta;
    case "error":
      return `${COLORS.Bright}${COLORS.BgRed}${COLORS.FgWhite}`;
    case "debug":
      return COLORS.FgGray;
    default:
      return COLORS.Reset;
  }
}
