import { webhookCallback } from "grammy";
import type { Request, Response } from "express";

import { Controller, Post, Req } from "@nestjs/common";
import { TelegramService } from "./telegram.service";

@Controller("telegram")
export class TelegramController {
  private handler: (request: Request) => Promise<Response>;

  constructor(private telegram: TelegramService) {
    // @ts-expect-error No overload matches this call
    this.handler = webhookCallback(this.telegram.bot, "express");
  }

  @Post("webhook")
  async handle(@Req() request: Request): Promise<Response> {
    return await this.handler(request);
  }
}
