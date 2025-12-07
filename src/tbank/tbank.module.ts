import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TBankController } from "./tbank.controller";
import { TBankService } from "./tbank.service";
import { NotificationPaymentWebhook } from "./webhooks/notification-payment.webhook";
import { TelegramModule } from "../telegram/telegram.module";

@Global()
@Module({
  imports: [ConfigModule, TelegramModule],
  providers: [TBankService, NotificationPaymentWebhook],
  controllers: [TBankController],
  exports: [TBankService],
})
export class TBankModule {}
