import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";
import { LeadHelper } from "../helpers/lead.helper";
import { AMO } from "../amo.constants";

@Injectable()
export class LeadChangeWebhook extends AbstractWebhook {
  async handle(data: unknown) {
    const lead = await LeadHelper.createFromWebhook(this.amo, data, { load_goods: true });

    lead.step(this.discount);
    lead.saveToAmo();
  }

  private discount(lead: LeadHelper): void {
    let abs_discount = 0;
    if (lead.custom_fields.has(AMO.CUSTOM_FIELD.DISCOUNT)) {
      const discount = lead.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT).toString();
      if (discount.includes("%")) {
        abs_discount = lead.totalPrice() * (+discount.replace("%", "") / 100);
      } else {
        abs_discount = +discount;
      }
    }

    const total_price = lead.totalPrice() - abs_discount;
    if (lead.data.price !== total_price) {
      lead.data.price = total_price;
      lead.note(
        `Цена изменена: ${total_price}₽${abs_discount > 0 ? " (" + abs_discount + "₽ скидка)" : ""}`,
      );
    }
  }
}
