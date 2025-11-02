import { Cdek } from "cdek";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LRUCache } from "lru-cache";

@Injectable()
export class CdekService {
  private readonly logger = new Logger(CdekService.name);
  private instance: Cdek;

  private printformToLeadMap: LRUCache<string, { leadId: number; cdekNumber: string }>;

  constructor(private readonly config: ConfigService) {
    this.instance = new Cdek({
      account: this.config.get<string>("CDEK_ACCOUNT"),
      password: this.config.get<string>("CDEK_PASSWORD"),
      url_base: this.config.get<"https://api.edu.cdek.ru/v2" | "https://api.cdek.ru/v2">(
        "CDEK_URL_BASE",
      ),
      on_error: (error) => this.logger.error(error.message, error.stack),
    });

    this.printformToLeadMap = new LRUCache<string, { leadId: number; cdekNumber: string }>({
      max: 100,
    });
  }

  get client(): Cdek {
    return this.instance;
  }

  setPrintformToLead(printformId: string, leadData: { leadId: number; cdekNumber: string }) {
    this.printformToLeadMap.set(printformId, leadData);
  }

  getPrintformToLead(printformId: string): { leadId: number; cdekNumber: string } | undefined {
    return this.printformToLeadMap.get(printformId);
  }
}
