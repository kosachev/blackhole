import { WinstonModule } from "nest-winston";
import winston from "winston";
import "winston-daily-rotate-file";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

import { GlobalExceptionFilter } from "./utils/global-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      level: process.env.LOG_LEVEL ?? "debug",
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp(),
            winston.format.printf(
              (item) =>
                `${item.timestamp} ${item.level} ${item.context ? "[" + item.context + "]" : ""}: ${item.message ?? ""}${item.data ? "\n" + JSON.stringify(item.data, null, 2) : ""}${item.stack ? "\n" + JSON.stringify(item.stack, null, 2) : ""}`,
            ),
          ),
        }),
        new winston.transports.DailyRotateFile({
          filename: "%DATE%.log",
          dirname: "./logs",
          level: "debug",
        }),
      ],
    }),
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 6969);
}
bootstrap();
