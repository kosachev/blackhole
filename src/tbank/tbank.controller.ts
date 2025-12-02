import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { AutoOkResponse } from "../utils/auto-ok-response.interceptor";
import { NotificationPaymentWebhook } from "./webhooks/notification-payment.webhook";

@Controller("tbank")
export class TBankController {
  constructor(private readonly notificationPayment: NotificationPaymentWebhook) {}

  @UseInterceptors(AutoOkResponse)
  @Post("payment")
  async webhook(@Body() data: any): Promise<string> {
    await this.notificationPayment.handler(data);
    return "OK";
  }
}
