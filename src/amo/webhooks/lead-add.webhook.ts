import { Lead } from "@shevernitskiy/amo";
import { Injectable, NotImplementedException } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";

@Injectable()
export class LeadAddWebhook extends AbstractWebhook {
  async handle(data: Lead) {
    this.logger.debug({ data });
    // this.amo, this.cdek is avaible here
    throw new NotImplementedException("LeadAddWebhook handler not implemented");
  }
}
