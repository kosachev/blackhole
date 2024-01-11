import { LogLevel } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: [(process.env.LOG_LEVEL as LogLevel) ?? "debug"],
  });
  await app.listen(process.env.PORT ?? 6969);
}
bootstrap();
