import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { CdekModule } from "./cdek/cdek.module";
import { LoggerMiddleware } from "./utils/logger.middleware";
import { AmoModule } from "./amo/amo.module";
import { CronService } from "./cron/cron.service";

@Module({
  imports: [
    CdekModule,
    AmoModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: [".env.dev", ".env.prod"],
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [CronService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
