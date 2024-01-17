import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Bot, Api } from "grammy";

@Injectable({})
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private static instance: Bot;

  constructor(private readonly config: ConfigService) {
    if (!TelegramService.instance) {
      TelegramService.instance = new Bot(this.config.get<string>("TELEGRAM_TOKEN"));
      if (this.config.get<string>("NODE_ENV") === "development") {
        TelegramService.instance.start();
      }
    }
  }

  get api(): Api {
    return TelegramService.instance.api;
  }

  get bot(): Bot {
    return TelegramService.instance;
  }
}
