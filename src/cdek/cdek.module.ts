import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CdekService } from "./cdek.service";
import { CdekController } from "./cdek.controller";
import { OrderStatusWebhook } from "./webhooks/order-status.webhook";
import { DownloadPhotoWebhook } from "./webhooks/download-photo.webhook";
import { PrealertCloseWebhook } from "./webhooks/prealert-close.webhook";
import { PrintFormWebhook } from "./webhooks/print-form.webhook";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    CdekService,
    OrderStatusWebhook,
    DownloadPhotoWebhook,
    PrealertCloseWebhook,
    PrintFormWebhook,
  ],
  controllers: [CdekController],
  exports: [CdekService],
})
export class CdekModule {}
