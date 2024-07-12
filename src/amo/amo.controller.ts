import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { LeadStatusWebhook } from "./webhooks/lead-status.webhook";
import { AutoOkResponse } from "../utils/auto-ok-response.interceptor";

@UseInterceptors(AutoOkResponse)
@Controller("amo")
export class AmoController {
  constructor(private readonly lead_status: LeadStatusWebhook) {}

  @Post("lead_status")
  async leadAdd(@Body() data: any): Promise<string> {
    await this.lead_status.handle(data);
    return "OK";
  }
}
