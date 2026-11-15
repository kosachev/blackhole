import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";
import { LeadHelper } from "../helpers/lead.helper";
import { AMO } from "../amo.constants";

@Injectable()
export class LeadAddWebhook extends AbstractWebhook {
  async handle(data: unknown) {
    // TODO: bad solution, delay 4s
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const lead = await LeadHelper.createFromWebhook(this.amo, data, { load_goods: true });
    const goods_total_price = lead.totalPrice();
    if (lead.data.price !== goods_total_price) {
      lead.data.price = goods_total_price;
      await lead.saveToAmo(); // if there will be more mutations later, place it in the end
    }

    let message = `💰 Новый заказ: <a href="https://${this.config.get<string>("AMO_DOMAIN")}/leads/detail/${lead.data.id}">${lead.data.name}</a> (<b>${lead.data.price}</b> руб.)`;
    if (lead.goods.size > 0) {
      message += `\n\n${[...lead.goods.values()].map((item) => `${item.name} - ${item.quantity}шт`).join("\n")}`;
    }

    const deliveryType = lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) || "не указан";
    const deliveryTypeHtml = deliveryType
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    message += `\n\nТип доставки: ${deliveryTypeHtml}`;

    await Promise.all([this.telegram.textToAdmin(message), this.telegram.textToManager(message)]);
    this.logger.log(`LEAD_ADD, lead_id: ${lead.data.id}`);
  }
}
