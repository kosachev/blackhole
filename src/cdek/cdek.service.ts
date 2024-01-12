import { Cdek } from "cdek";
import {
  UpdateDownloadPhoto,
  UpdateOrderStatus,
  UpdatePrealertClosed,
  UpdatePrintForm,
} from "cdek/src/types/api/webhook";

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
    });

    this.instance.on("ORDER_STATUS", (ctx: UpdateOrderStatus) => this.order_status(ctx));
    this.instance.on("PRINT_FORM", (ctx: UpdatePrintForm) => this.print_form(ctx));
    this.instance.on("DOWNLOAD_PHOTO", (ctx: UpdateDownloadPhoto) => this.download_photo(ctx));
    this.instance.on("PREALERT_CLOSED", (ctx: UpdatePrealertClosed) => this.prealert_closed(ctx));
  }

  get client(): Cdek {
    return this.instance;
  }

  // TODO: implement logic
  private order_status(ctx: UpdateOrderStatus): void {
    this.logger.log(`order ${ctx.attributes.cdek_number} => status ${ctx.attributes.code}`);
  }

  // TODO: implement logic
  private print_form(ctx: UpdatePrintForm): void {
    this.logger.log(`print_form ${ctx}`);
  }

  // TODO: implement logic
  private download_photo(ctx: UpdateDownloadPhoto): void {
    this.logger.log(`download_photo ${ctx}`);
  }

  // TODO: implement logic
  private prealert_closed(ctx: UpdatePrealertClosed): void {
    this.logger.log(`prealert_closed ${ctx}`);
  }
}
