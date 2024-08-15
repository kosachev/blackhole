import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";
import { LeadHelper } from "../helpers/lead.helper";
import { AMO } from "../amo.constants";

@Injectable()
export class LeadStatusWebhook extends AbstractWebhook {
  async handle(data: unknown) {
    const lead = await LeadHelper.createFromWebhook(this.amo, data, {
      load_goods: true,
      load_contact: true,
    });

    switch (lead.data.status_id) {
      case AMO.STATUS.REQUISITE: {
        await this.statusRequisite(lead);
        break;
      }
      case AMO.STATUS.PAYMENT: {
        await this.statusPayment(lead);
        break;
      }
      case AMO.STATUS.DELIVERY: {
        await this.statusDelivery(lead);
        break;
      }
    }

    await lead.saveToAmo();
  }

  async statusRequisite(lead: LeadHelper) {
    const delivery_type = lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE);
    if (!delivery_type) {
      lead.error("❌ Не выбран тип доставки");
    } else if (delivery_type !== "Экспресс по России" && delivery_type !== "Почта России") {
      lead.error(`❌ Оплата для типа доставки ${delivery_type} не требуется`);
    }
    const email = lead.contact.custom_fields.get(AMO.CONTACT.EMAIL);
    const phone = lead.contact.custom_fields.get(AMO.CONTACT.PHONE);
    if (!lead.contact.name || lead.contact.name === "") lead.error("❌ Не указано ФИО");
    if (!email || email === "") lead.error("❌ У контакта не указан email");
    if (!phone || phone === "") lead.error("❌ У контакта не указан телефон");
    if (lead.goods.size === 0) lead.error("❌ В сделке нет товаров");

    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.INDEX)) lead.warning("⚠️ Не указан индекс");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.CITY)) lead.warning("⚠️ Не указан город");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.STREET)) lead.warning("⚠️ Не указана улица");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.BUILDING)) lead.warning("⚠️ Не указан дом");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.FLAT)) lead.warning("⚠️ Не указана квартира");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID))
      lead.warning("⚠️ Не указан номер заказа");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY)) lead.warning("⚠️ Не указана предоплата");

    if (lead.errors.length > 0 || lead.warnings.length > 0) {
      lead.note(["🔍 Проверка: Реквизиты", ...lead.errors, ...lead.warnings].join("\n"));
    }
    if (lead.errors.length > 0) return;

    let prepay = lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY)
      ? Number(lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY))
      : 0;
    if (isNaN(prepay)) prepay = 0;

    try {
      await this.mail.invoice({
        name: lead.contact.name,
        address: [
          lead.custom_fields.get(AMO.CUSTOM_FIELD.INDEX) ?? "",
          lead.custom_fields.get(AMO.CUSTOM_FIELD.CITY) ?? "",
          lead.custom_fields.get(AMO.CUSTOM_FIELD.STREET) ?? "",
          lead.custom_fields.get(AMO.CUSTOM_FIELD.BUILDING) ?? "",
          lead.custom_fields.get(AMO.CUSTOM_FIELD.FLAT) ?? "",
        ].join(", "),
        phone: phone,
        email: email,
        delivery_type: delivery_type as string,
        order_number: lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) as string,
        goods: [...lead.goods.values()].map((good) => ({
          name: good.name,
          quantity: good.quantity,
          price: good.price,
        })),
        total_price: lead.data.price,
        discount: lead.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT) as string,
        prepayment: prepay,
      });

      lead.note("✅ email: письмо с реквизитами отправлено");
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ email: ошибка при отправке письма с реквизитами");
    }
  }

  async statusPayment(lead: LeadHelper) {
    const email = lead.contact.custom_fields.get(AMO.CONTACT.EMAIL);
    if (!email || email === "") lead.error("❌ У контакта не указан email");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID)) lead.error("❌ Не указан номер заказа");

    if (lead.errors.length > 0) {
      lead.note(["🔍 Проверка: Оплата", ...lead.errors].join("\n"));
      return;
    }

    try {
      await this.mail.prepaymentConfirm({
        email: email,
        order_number: lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) as string,
      });

      lead.note("✅ email: письмо с подтверждением оплаты отправлено");
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ email: ошибка при отправке письма с подтверждением оплаты");
    }
  }

  async statusDelivery(lead: LeadHelper) {
    const delivery_type = lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE);
    if (!delivery_type) {
      lead.error("❌ Не выбран тип доставки");
    } else if (
      delivery_type !== "Курьером (в пределах МКАД)" &&
      delivery_type !== "Курьером (Московская область)"
    ) {
      lead.error(`❌ Неверный тип доставки ${delivery_type} для статуса`);
    }

    const phone = lead.contact.custom_fields.get(AMO.CONTACT.PHONE);
    if (!phone || phone === "") lead.error("❌ У контакта не указан телефон");
    if (lead.goods.size === 0) lead.error("❌ В сделке нет товаров");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID)) lead.error("❌ Не указан номер заказа");

    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.CITY)) lead.warning("⚠️ Не указан город");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.STREET)) lead.warning("⚠️ Не указана улица");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.BUILDING)) lead.warning("⚠️ Не указан дом");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.FLAT)) lead.warning("⚠️ Не указана квартира");
    if (!lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_COST))
      lead.warning("⚠️ Не указана стоимость доставки");

    if (lead.errors.length > 0 || lead.warnings.length > 0) {
      lead.note(["🔍 Проверка: Доставка", ...lead.errors, ...lead.warnings].join("\n"));
    }
    if (lead.errors.length > 0) return;

    try {
      const pdf = await this.pfd.invoice({
        order_id: lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) as string,
        customer_name: lead.contact.name,
        customer_phone: phone,
        customer_address: [
          lead.custom_fields.get(AMO.CUSTOM_FIELD.CITY) ?? "",
          lead.custom_fields.get(AMO.CUSTOM_FIELD.STREET) ?? "",
          lead.custom_fields.get(AMO.CUSTOM_FIELD.BUILDING) ?? "",
          lead.custom_fields.get(AMO.CUSTOM_FIELD.FLAT) ?? "",
        ].join(", "),
        delivery_time: lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TIME) as string,
        payment_type: lead.custom_fields.get(AMO.CUSTOM_FIELD.PAY_TYPE) as string,
        goods: [...lead.goods.values()].map((good) => ({
          name: good.name,
          price: good.price,
          quantity: good.quantity,
        })),
      });

      const yadisk_url = await this.yadisk.upload(
        `Товарный_чек_${lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID)}.pdf`,
        Buffer.from(pdf),
      );

      lead.note(`✎ Сформирован товарный чек: ${yadisk_url}`);
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ Товарный чек: ошибка при создании товарного чека");
    }
  }
}
