import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { AutoOkResponse } from "../utils/auto-ok-response.interceptor";
import { LeadStatusWebhook } from "./webhooks/lead-status.webhook";
import { LeadAddWebhook } from "./webhooks/lead-add.webhook";
import { LeadChangeWebhook } from "./webhooks/lead-change.webhook";
import { LeadCreateService, type Order, type Good } from "./lead-create.service";
import { type CallRequest, CallRequestService } from "./call-request.service";

@Controller("amo")
export class AmoController {
  constructor(
    private readonly lead_status: LeadStatusWebhook,
    private readonly lead_add: LeadAddWebhook,
    private readonly lead_change: LeadChangeWebhook,
    private readonly lead_create: LeadCreateService,
    private readonly call_request: CallRequestService,
  ) {}

  @UseInterceptors(AutoOkResponse)
  @Post("lead_status")
  async leadStatus(@Body() data: any): Promise<string> {
    await this.lead_status.handle(data);
    return "OK";
  }

  @UseInterceptors(AutoOkResponse)
  @Post("lead_add")
  async leadAdd(@Body() data: any): Promise<string> {
    await this.lead_add.handle(data);
    return "OK";
  }

  @UseInterceptors(AutoOkResponse)
  @Post("lead_change")
  async leadChange(@Body() data: any): Promise<string> {
    await this.lead_change.handle(data);
    return "OK";
  }

  @Post("lead_create")
  async leadCreate(@Body() data: Order): Promise<string> {
    await this.lead_create.leadCreateHandler(data);
    return "OK";
  }

  @Post("good_emplace")
  async goodEmplace(@Body() data: Good): Promise<string> {
    await this.lead_create.goodEmplaceHandler(data);
    return "OK";
  }

  @Post("call_request")
  async callRequest(@Body() data: CallRequest): Promise<string> {
    await this.call_request.callRequesthandler(data);
    return "OK";
  }
}
