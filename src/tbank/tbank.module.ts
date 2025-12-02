import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TBankController } from "./tbank.controller";
import { TBankService } from "./tbank.service";
import { NotificationPaymentWebhook } from "./webhooks/notification-payment.webhook";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [TBankService, NotificationPaymentWebhook],
  controllers: [TBankController],
  exports: [TBankService],
})
export class TBankModule {}
