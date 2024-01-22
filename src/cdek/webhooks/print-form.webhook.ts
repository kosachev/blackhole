import { UpdatePrintForm } from "cdek/src/types/api/webhook";
import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";

@Injectable()
export class PrintFormWebhook extends AbstractWebhook {
  async handle(data: UpdatePrintForm) {
    this.logger.debug("incoming webhook print-form");
    this.logger.debug({ data });
    // this.amo, this.cdek is avaible here
  }
}
