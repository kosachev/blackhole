import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AmoModule } from "./amo/amo.module";
import { CdekModule } from "./cdek/cdek.module";
import { CronModule } from "./cron/cron.module";
import { GoogleSheetsModule } from "./google-sheets/google-sheets.module";
import { MailModule } from "./mail/mail.module";
import { PartialReturnModule } from "./partial-return/partial-return.module";
import { PDFModule } from "./pdf/pdf.module";
import { TelegramModule } from "./telegram/telegram.module";
import { YandexDiskModule } from "./yandex-disk/yandex-disk.module";

import { LoggerMiddleware } from "./utils/logger.middleware";

@Module({
  imports: [
    CdekModule,
    AmoModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: [".env.dev", ".env.prod", ".env.example"],
      isGlobal: true,
    }),
    TelegramModule,
    CronModule,
    MailModule,
    YandexDiskModule,
    PDFModule,
    GoogleSheetsModule,
    PartialReturnModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
