import { Cdek } from "cdek";
import {
  UpdateDownloadPhoto,
  UpdateOrderStatus,
  UpdatePrealertClosed,
  UpdatePrintForm,
} from "cdek/src/types/api/webhook";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CdekService {
  private instance: Cdek;

  constructor(private readonly config: ConfigService) {
    this.instance = new Cdek({
      account: this.config.get<string>("CDEK_ACCOUNT"),
      password: this.config.get<string>("CDEK_PASSWORD"),
      url_base: this.config.get<"https://api.edu.cdek.ru/v2" | "https://api.cdek.ru/v2">(
        "CDEK_URL_BASE",
      ),
    });

    this.instance.on("ORDER_STATUS", this.order_status);
    this.instance.on("PRINT_FORM", this.print_form);
    this.instance.on("DOWNLOAD_PHOTO", this.download_photo);
    this.instance.on("PREALERT_CLOSED", this.prealert_closed);
  }

  get client(): Cdek {
    return this.instance;
  }

  // TODO: implement logic
  private order_status(ctx: UpdateOrderStatus): void {
    console.log(`order ${ctx.attributes.cdek_number} => status ${ctx.attributes.code}`);
  }

  // TODO: implement logic
  private print_form(ctx: UpdatePrintForm): void {
    console.log(`print_form ${ctx}`);
  }

  // TODO: implement logic
  private download_photo(ctx: UpdateDownloadPhoto): void {
    console.log(`download_photo ${ctx}`);
  }

  // TODO: implement logic
  private prealert_closed(ctx: UpdatePrealertClosed): void {
    console.log(`prealert_closed ${ctx}`);
  }
}
