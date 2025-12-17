import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TBankController } from "./tbank.controller";
import { TBankService } from "./tbank.service";
import { NotificationPaymentWebhook } from "./webhooks/notification-payment.webhook";
import { TelegramModule } from "../telegram/telegram.module";
import { TBankReceiptStatusCheckService } from "./tbank-receipt-status-check.service";

@Global()
@Module({
  imports: [ConfigModule, TelegramModule],
  providers: [TBankService, NotificationPaymentWebhook, TBankReceiptStatusCheckService],
  controllers: [TBankController],
  exports: [TBankService, TBankReceiptStatusCheckService],
})
export class TBankModule {}
