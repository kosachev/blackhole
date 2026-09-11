import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { CdekService } from "./cdek.service";
import { Cron } from "@nestjs/schedule";
import { TelegramService } from "../telegram/telegram.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CdekWebhookCheckService implements OnModuleInit {
  private readonly logger = new Logger(CdekWebhookCheckService.name);

  private missingWebhooks?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly cdek: CdekService,
    private readonly telegram: TelegramService,
  ) {}

  async onModuleInit() {
    await this.checkCdekWebhooks();
  }

  // executes every hour
  @Cron("0 0 * * * *")
  async checkCdekWebhooks() {
    try {
      const needed = [
        { url: `${this.config.get("BACKEND_BASE")}/cdek/webhook`, type: "ORDER_STATUS" },
        { url: `${this.config.get("BACKEND_BASE")}/cdek/webhook`, type: "PRINT_FORM" },
      ];

      const current = await this.cdek.client.getWebhooks();
      const missing = needed.filter((need) =>
        current?.some((curr) => curr.url === need.url && curr.type === need.type),
      );

      if (missing.length === 0) {
        this.missingWebhooks = undefined;
        return;
      }

      const missingMessage = missing.map((need) => `${need.type} - ${need.url}`).join("\n");

      if (this.missingWebhooks !== missingMessage) {
        this.missingWebhooks = missingMessage;
        this.logger.warn(`CDER_WEBHOOKS_CHECK, missing webhooks:${missing.length}`);
        await this.telegram.textToAdmin(`⚠️ СДЭК - вебхуки не найдены:\n${missingMessage}`);
      }
    } catch (error) {
      this.logger.error("Error checking CDEK webhooks:", error);
    }
  }
}
