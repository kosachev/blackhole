import { Body, Controller, Logger, Post, Get, UseInterceptors } from "@nestjs/common";
import { OrderStatusWebhook } from "./webhooks/order-status.webhook";
import { PrealertCloseWebhook } from "./webhooks/prealert-close.webhook";
import { DownloadPhotoWebhook } from "./webhooks/download-photo.webhook";
import { PrintFormWebhook } from "./webhooks/print-form.webhook";
import { ExecutionTime } from "../utils/execution-time.interceptor";
import { AutoOkResponse } from "src/utils/auto-ok-response.interceptor";

@Controller("cdek")
export class CdekController {
  private readonly logger = new Logger("CdekController");
  private execution_time: number;

  constructor(
    private readonly order_status: OrderStatusWebhook,
    private readonly print_form: PrintFormWebhook,
    private readonly download_photo: DownloadPhotoWebhook,
    private readonly prealert_close: PrealertCloseWebhook,
  ) {
    CdekController.prototype.execution_time = Date.now();
  }

  @UseInterceptors(ExecutionTime)
  @UseInterceptors(AutoOkResponse)
  @Post("webhook")
  async handle(@Body() data: any): Promise<string> {
    switch (data.type) {
      case "ORDER_STATUS":
        await this.order_status.handle(data);
        break;
      case "PRINT_FORM":
        await this.print_form.handle(data);
        break;
      case "DOWNLOAD_PHOTO":
        await this.download_photo.handle(data);
        break;
      case "PREALERT_CLOSED":
        await this.prealert_close.handle(data);
        break;
    }
    return "OK";
  }

  @Get("execution_time")
  executionTime(): number {
    return this.execution_time;
  }
}
