import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { UtmService } from "./utm.service";
import { AnalyticsController } from "./analytics.controller";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [UtmService],
  controllers: [AnalyticsController],
  exports: [UtmService],
})
export class AnalyticsModule {}
