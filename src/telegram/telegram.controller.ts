import { webhookCallback } from "grammy";
import { Request } from "express";

import { Controller, Post } from "@nestjs/common";
import { TelegramService } from "./telegram.service";

@Controller("telegram")
export class TelegramController {
  private handler: (request: Request) => Promise<Response>;

  constructor(private telegram: TelegramService) {
    this.handler = webhookCallback(this.telegram.bot, "express");
  }

  @Post("webhook")
  async handle(request: Request): Promise<string> {
    this.handler(request);
    return "OK";
  }
}
