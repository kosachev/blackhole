import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { LeadAddWebhook } from "./webhooks/lead-add.webhook";
import { AutoOkResponse } from "../utils/auto-ok-response.interceptor";

@UseInterceptors(AutoOkResponse)
@Controller("amo")
export class AmoController {
  constructor(private readonly lead_add: LeadAddWebhook) {}

  // TODO: dto here to deserialization?
  @Post("lead-add")
  async leadAdd(@Body() data: any): Promise<string> {
    await this.lead_add.handle(data);
    return "OK";
  }
}
