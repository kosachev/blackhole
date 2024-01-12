import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CdekModule } from "./cdek/cdek.module";
import { LoggerMiddleware } from "./utils/logger.middleware";
import { AmoModule } from './amo/amo.module';

@Module({
  imports: [
    CdekModule,
    ConfigModule.forRoot({
      envFilePath: [".env.dev", ".env.prod"],
      isGlobal: true,
    }),
    AmoModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
