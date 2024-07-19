import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";
import { LeadHelper } from "../helpers/lead.helper";
import { AMO } from "../amo.constants";

type CheckStep = [LeadHelper, boolean, string[]];

//                         вс  пн  вт  ср  чт  пт  сб
const defaultPickupStart = [9, 15, 15, 15, 15, 15, 11];

@Injectable()
export class LeadChangeWebhook extends AbstractWebhook {
  async handle(data: unknown) {
    let save = false;
    let notes: string[] = [];
    let lead = await LeadHelper.createFromWebhook(this.amo, data, { load_goods: true });
    [lead, save, notes] = this.discount([lead, save, notes]);
    [lead, save, notes] = await this.cdekPickup([lead, save, notes]);

    const promises: Promise<unknown>[] = [];
    if (save) {
      promises.push(lead.saveToAmo());
    }
    if (notes.length > 0) {
      promises.push(lead.note(notes));
    }

    await Promise.all(promises);
  }

  private discount([lead, save, notes]: CheckStep): CheckStep {
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
      notes.push(
        `Цена изменена: ${total_price}₽${abs_discount > 0 ? " (" + abs_discount + "₽ скидка)" : ""}`,
      );
      return [lead, true, notes];
    }

    return [lead, save ?? false, notes];
  }

  private async cdekPickup([lead, save, notes]: CheckStep): Promise<CheckStep> {
    if (
      lead.custom_fields.get(AMO.CUSTOM_FIELD.COURIER_CALLED) === "да" ||
      !lead.custom_fields.has(AMO.CUSTOM_FIELD.COURIER_PICKUP_DATE)
    ) {
      return [lead, save ?? false, notes];
    }

    const notes_size = notes.length;
    const d = new Date();
    const current_hour = d.getHours();
    const current_day_of_week = d.getDay();

    if (
      !(lead.custom_fields.get(AMO.CUSTOM_FIELD.TRACK_NUMBER)?.toString().length > 0) ||
      !(lead.custom_fields.get(AMO.CUSTOM_FIELD.CDEK_UUID)?.toString().length > 0)
    ) {
      notes.push("✖ СДЕК: Нельзя вызвать курьера для сделки у которой нет трек кода или uuid");
    }

    const pickup_timestamp =
      +lead.custom_fields.get(AMO.CUSTOM_FIELD.COURIER_PICKUP_DATE)[0] * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (pickup_timestamp < today.getTime()) {
      notes.push("✖ СДЕК: Дата вызова курьера должна быть не раньше сегодняшнего дня");
    }
    if (pickup_timestamp === today.getTime() && current_hour >= 15) {
      notes.push("✖ СДЕК: Уже поздно вызвать курьера сегодня, вызов доступен только до 15:00");
    }

    // if some checks failed
    if (notes.length > notes_size) {
      lead.custom_fields.set(AMO.CUSTOM_FIELD.COURIER_PICKUP_DATE, null);
      return [lead, true, notes];
    }

    const pickup_date = new Date(pickup_timestamp);
    let pickup_start = defaultPickupStart[pickup_date.getDay()];

    if (
      current_day_of_week >= 1 &&
      current_day_of_week <= 5 &&
      lead.custom_fields.has(AMO.CUSTOM_FIELD.COURIER_PICKUP_TIME)
    ) {
      pickup_start = +(
        lead.custom_fields.get(AMO.CUSTOM_FIELD.COURIER_PICKUP_TIME) as string
      ).split(":")[0];
    }

    try {
      const result = await this.cdek.addCourier({
        order_uuid: lead.custom_fields.get(AMO.CUSTOM_FIELD.CDEK_UUID) as string,
        cdek_number: lead.custom_fields.get(AMO.CUSTOM_FIELD.TRACK_NUMBER) as number,
        intake_date: `${pickup_date.getFullYear()}-${String(pickup_date.getMonth() + 1).padStart(2, "0")}-${String(pickup_date.getDate()).padStart(2, "0")}`,
        intake_time_from: `${pickup_start}:00`,
        intake_time_to: `${pickup_start + 3}:00`,
      });
      if (!result) throw new Error("CDEK: addCourier failed");
      // TODO: check errors in result?
      lead.custom_fields.set(AMO.CUSTOM_FIELD.COURIER_CALLED, "да");
      notes.push(
        `✔ СДЕК: Курьер вызван на ${pickup_date.toLocaleDateString("ru-RU")}, время ${pickup_start}:00-${pickup_start + 3}:00`,
      );
      return [lead, true, notes];
    } catch (err) {
      lead.custom_fields.set(AMO.CUSTOM_FIELD.COURIER_PICKUP_DATE, null);
      notes.push(`✖ СДЕК: не удалось вызвать курьера, ошибка сдек api`);
      return [lead, true, notes];
    }
  }
}
