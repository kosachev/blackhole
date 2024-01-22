import { Cdek } from "cdek";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CdekService {
  private readonly logger = new Logger(CdekService.name);
  private instance: Cdek;

  constructor(private readonly config: ConfigService) {
    this.instance = new Cdek({
      account: this.config.get<string>("CDEK_ACCOUNT"),
      password: this.config.get<string>("CDEK_PASSWORD"),
      url_base: this.config.get<"https://api.edu.cdek.ru/v2" | "https://api.cdek.ru/v2">(
        "CDEK_URL_BASE",
      ),
      on_error: (error) => this.logger.error(error),
    });
  }

  get client(): Cdek {
    return this.instance;
  }
}
