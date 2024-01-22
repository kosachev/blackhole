import { UpdatePrealertClosed } from "cdek/src/types/api/webhook";
import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";

@Injectable()
export class PrealertCloseWebhook extends AbstractWebhook {
  async handle(data: UpdatePrealertClosed) {
    this.logger.debug("incoming webhook prealert-close");
    this.logger.debug({ data });
    // this.amo, this.cdek is avaible here
  }
}
