import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CdekModule } from "./cdek/cdek.module";
import { LoggerMiddleware } from "./utils/logger.middleware";

@Module({
  imports: [
    CdekModule,
    ConfigModule.forRoot({
      envFilePath: [".env.dev", ".env.prod"],
      isGlobal: true,
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
