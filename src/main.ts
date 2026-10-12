import "reflect-metadata";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import winston from "winston";
import "winston-daily-rotate-file";
import { WinstonModule } from "nest-winston";
import { NestFactory } from "@nestjs/core";
import { GlobalExceptionFilter } from "./utils/global-exception.filter";

const local = process.argv.includes("--local");
const rootModule = local
  ? (await import("./local-app.module")).LocalAppModule
  : (await import("./app.module")).AppModule;

console.log(`[Init] Version: ${typeof VERSION === "undefined" ? "development" : VERSION}`);
console.log(`[Init] Mode: ${local ? "local HTTP (database UI only)" : process.env["NODE_ENV"]}`);

const timestamp_tz = () => new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

const app = await NestFactory.create(rootModule, {
  httpsOptions:
    !local && process.env["NODE_ENV"] === "production"
      ? {
          key: readFileSync(resolve(process.cwd(), process.env["SSL_KEY_PATH"])),
          cert: readFileSync(resolve(process.cwd(), process.env["SSL_CERT_PATH"])),
        }
      : undefined,
  logger: WinstonModule.createLogger({
    level: process.env["LOG_LEVEL"] ?? "debug",
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.timestamp({ format: timestamp_tz }),
          winston.format.printf(
            (item) =>
              `${item.timestamp} ${item.level} ${item.context ? "[" + item.context + "]" : ""}: ${
                item.message ?? ""
              }${item.data ? "\n" + JSON.stringify(item.data, null, 2) : ""}${
                item.stack ? "\n" + JSON.stringify(item.stack, null, 2) : ""
              }`,
          ),
        ),
      }),
      new winston.transports.DailyRotateFile({
        filename: "%DATE%.log",
        dirname: "logs",
        level: "debug",
        format: winston.format.combine(
          winston.format.timestamp({ format: timestamp_tz }),
          winston.format.json(),
        ),
      }),
    ],
  }),
});

app.useGlobalFilters(new GlobalExceptionFilter());
app.enableCors();

const port = process.env["PORT"] ?? 6969;
if (local) {
  await app.listen(port, "127.0.0.1");
  console.log(`[Init] Database UI: ${await app.getUrl()}/public/db-ui.html`);
} else {
  await app.listen(port);
}
