import { Body, Controller, Post } from "@nestjs/common";
import { CdekService } from "./cdek.service";
import { OrderStatusWebhook } from "./webhooks/order-status.webhook";

@Controller("cdek")
export class CdekController {
  private handler: (request: Request) => Promise<Response>;

  constructor(
    private cdek: CdekService,
    private readonly order_status: OrderStatusWebhook,
  ) {
    this.handler = this.cdek.client.webhookHandler();
  }

  @Post("webhook")
  handle(@Body() data: any): string {
    switch (data.type) {
      case "ORDER_STATUS":
        this.order_status.handle(data);
        break;
      case "PRINT_FORM":
        this.order_status.handle(data);
        break;
      case "DOWNLOAD_PHOTO":
        this.order_status.handle(data);
        break;
      case "PREALERT_CLOSED":
        this.order_status.handle(data);
        break;
    }
    return "OK";
  }
}
