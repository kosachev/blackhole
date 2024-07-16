import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { AutoOkResponse } from "../utils/auto-ok-response.interceptor";
import { LeadStatusWebhook } from "./webhooks/lead-status.webhook";
import { LeadAddWebhook } from "./webhooks/lead-add.webhook";

@UseInterceptors(AutoOkResponse)
@Controller("amo")
export class AmoController {
  constructor(
    private readonly lead_status: LeadStatusWebhook,
    private readonly lead_add: LeadAddWebhook,
  ) {}

  @Post("lead_status")
  async leadStatus(@Body() data: any): Promise<string> {
    await this.lead_status.handle(data);
    return "OK";
  }

  @Post("lead_add")
  async leadAdd(@Body() data: any): Promise<string> {
    await this.lead_add.handle(data);
    return "OK";
  }
}
