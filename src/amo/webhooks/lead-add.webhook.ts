import { Lead } from "@shevernitskiy/amo";
import { Injectable, NotImplementedException } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";
import { LeadHelper } from "../helpers/lead.helper";

@Injectable()
export class LeadAddWebhook extends AbstractWebhook {
  async handle(data: Lead) {
    const lead = await LeadHelper.createFromWebhook(this.amo, data, { load_goods: true });
    const goods_total_price = lead.totalPrice();
    if (lead.data.price !== goods_total_price) {
      lead.data.price = goods_total_price;
      await lead.saveToAmo(); // if there will be more mutations later, place it in the end
    }
  }
}
