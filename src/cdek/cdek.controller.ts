import { Body, Controller, Post } from "@nestjs/common";
import { OrderStatusWebhook } from "./webhooks/order-status.webhook";
import { PrealertCloseWebhook } from "./webhooks/prealert-close.webhook";
import { DownloadPhotoWebhook } from "./webhooks/download-photo.webhook";
import { PrintFormWebhook } from "./webhooks/print-form.webhook";

@Controller("cdek")
export class CdekController {
  constructor(
    private readonly order_status: OrderStatusWebhook,
    private readonly print_form: PrintFormWebhook,
    private readonly download_photo: DownloadPhotoWebhook,
    private readonly prealert_close: PrealertCloseWebhook,
  ) {}

  @Post("webhook")
  handle(@Body() data: any): string {
    switch (data.type) {
      case "ORDER_STATUS":
        this.order_status.handle(data);
        break;
      case "PRINT_FORM":
        this.print_form.handle(data);
        break;
      case "DOWNLOAD_PHOTO":
        this.download_photo.handle(data);
        break;
      case "PREALERT_CLOSED":
        this.prealert_close.handle(data);
        break;
    }
    return "OK";
  }
}
