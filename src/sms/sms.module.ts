import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { SmsService } from "./sms.service";
import { SmsController } from "./sms.controller";
import { StatusWebhook } from "./webhooks/status.webhook";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SmsService, StatusWebhook],
  controllers: [SmsController],
  exports: [SmsService],
})
export class SmsModule {}
