import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AmoModule } from "./amo/amo.module";
import { CdekModule } from "./cdek/cdek.module";
import { CronModule } from "./cron/cron.module";
import { GoogleSheetsModule } from "./google-sheets/google-sheets.module";
import { MailModule } from "./mail/mail.module";
import { WebModule } from "./web/web.module";
import { PDFModule } from "./pdf/pdf.module";
import { TelegramModule } from "./telegram/telegram.module";
import { YandexDiskModule } from "./yandex-disk/yandex-disk.module";
import { YandexMetrikaModule } from "./yandex-metrika/yandex-metrika.module";
import { LogViewerModule } from "./log-viewer/log-viewer.module";
import { LoggerMiddleware } from "./utils/logger.middleware";
import { PostModule } from "./post/post.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { TildaModule } from "./tilda/tilda.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { TBankModule } from "./tbank/tbank.module";
import { resolve } from "path";

@Module({
  imports: [
    CdekModule,
    AmoModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: [".env.dev", ".env.prod", ".env.example"],
      isGlobal: true,
    }),
    TildaModule,
    TBankModule,
    AnalyticsModule,
    TelegramModule,
    CronModule,
    MailModule,
    YandexDiskModule,
    YandexMetrikaModule,
    PDFModule,
    GoogleSheetsModule,
    WebModule,
    PostModule,
    LogViewerModule,
    ServeStaticModule.forRoot({
      rootPath: resolve("./public"),
      serveRoot: "/public",
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
