import winston from "winston";
import { WinstonModule } from "nest-winston";

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
              ({ timestamp, level, context, message, data }) =>
                `${timestamp} ${level} ${context ? "[" + context + "]" : ""}: ${message ?? ""}${
                  data ? "\n" + JSON.stringify(data, null, 2) : ""
                }`,
            ),
          ),
        }),
        new winston.transports.File({
          filename: "logs/combined.log",
          level: "info",
          format: winston.format.json(),
        }),
      ],
    }),
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 6969);
}
bootstrap();
