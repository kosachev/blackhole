import { UpdatePrintForm } from "cdek/src/types/api/webhook";
import { Injectable, NotImplementedException } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";

@Injectable()
export class PrintFormWebhook extends AbstractWebhook {
  async handle(data: UpdatePrintForm) {
    this.logger.debug({ data });
    // this.amo, this.cdek is avaible here
    throw new NotImplementedException("PrintFormWebhook handler not implemented");
  }
}
