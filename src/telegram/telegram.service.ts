import { Bot, Api, GrammyError, HttpError } from "grammy";
import type { Message } from "grammy/types";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private static instance: Bot;

  constructor(private readonly config: ConfigService) {
    if (!TelegramService.instance) {
      TelegramService.instance = new Bot(this.config.get<string>("TELEGRAM_TOKEN"));

      TelegramService.instance.catch((err) => {
        if (err.error instanceof GrammyError) {
          this.logger.error(`Error in request: ${err.error.description}`, err.error.stack);
        } else if (err.error instanceof HttpError) {
          this.logger.error("Could not contact Telegram", err.error.stack);
        } else {
          this.logger.error("Unknown error", err.error);
        }
      });

      // if (this.config.get<string>("NODE_ENV") === "development") {
      //   TelegramService.instance.start();
      // }
    }
  }

  get api(): Api {
    return TelegramService.instance.api;
  }

  get bot(): Bot {
    return TelegramService.instance;
  }

  textToAdmin(text: string): Promise<Message.TextMessage> {
    return this.api.sendMessage(this.config.get<number>("TELEGRAM_ADMIN_ID"), text, {
      parse_mode: "HTML",
    });
  }
  textToManager(text: string): Promise<Message.TextMessage> {
    return this.api.sendMessage(this.config.get<number>("TELEGRAM_MANAGER_ID"), text, {
      parse_mode: "HTML",
    });
  }
}
