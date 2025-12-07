import "reflect-metadata";
import winston from "winston";
import "winston-daily-rotate-file";
import { WinstonModule } from "nest-winston";
import { readFileSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./utils/global-exception.filter";
import { resolve } from "node:path";

if (!process.env["NODE_ENV"]) {
  console.error("❌ [Init] NODE_ENV is not set");
  process.exit(1);
} else {
  console.log(`✅ [Init] Environment: ${process.env["NODE_ENV"]}`);
}

const timestamp_tz = () => new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    httpsOptions:
      process.env["NODE_ENV"] === "production"
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

  await app.listen(process.env["PORT"] ?? 6969);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
