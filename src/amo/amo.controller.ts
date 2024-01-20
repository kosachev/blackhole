import { Body, Controller, Post } from "@nestjs/common";
import { LeadAddWebhook } from "./webhooks/lead-add.webhook";

@Controller("amo")
export class AmoController {
  constructor(private readonly lead_add: LeadAddWebhook) {}

  // TODO: dto here to deserialization?
  @Post("lead-add")
  async leadAdd(@Body() data: any): Promise<string> {
    this.lead_add.handle(data);
    return "OK";
  }
}
