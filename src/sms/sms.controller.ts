import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";

import { AutoOkResponse } from "../utils/auto-ok-response.interceptor";
import { StatusWebhook, type RedSmsWebhookData } from "./webhooks/status.webhook";

@Controller("sms")
export class SmsController {
  constructor(private readonly status: StatusWebhook) {}

  @UseInterceptors(AutoOkResponse)
  @Post("webhook")
  async webhook(@Body() data: RedSmsWebhookData): Promise<string> {
    await this.status.handle(data);
    return "OK";
  }
}
