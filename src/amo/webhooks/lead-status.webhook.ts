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
    this.validation(lead, [
      "delivery_type_exists",
      "delivery_type_cdek_or_post",
      "email_exists",
      "phone_exists",
      "name_exists",
      "goods_exists",
      "order_number_exists",
      "index_exists",
      "city_exists",
      "street_exists",
      "building_exists",
      "flat_exists",
      "prepay_exists",
    ]);

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
        phone: lead.contact.custom_fields.get(AMO.CONTACT.PHONE),
        email: lead.contact.custom_fields.get(AMO.CONTACT.EMAIL),
        delivery_type: lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
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
    this.validation(lead, ["email_exists", "order_number_exists"]);

    if (lead.errors.length > 0) {
      lead.note(["🔍 Проверка: Оплата", ...lead.errors].join("\n"));
      return;
    }

    try {
      await this.mail.prepaymentConfirm({
        email: lead.contact.custom_fields.get(AMO.CONTACT.EMAIL),
        order_number: lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) as string,
      });

      lead.note("✅ email: письмо с подтверждением оплаты отправлено");
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ email: ошибка при отправке письма с подтверждением оплаты");
    }
  }

  async statusDelivery(lead: LeadHelper) {
    this.validation(lead, [
      "delivery_type_exists",
      "delivery_type_courier",
      "phone_exists",
      "goods_exists",
      "order_number_exists",
      "city_exists",
      "street_exists",
      "building_exists",
      "flat_exists",
      "prepay_exists",
    ]);

    if (lead.errors.length > 0 || lead.warnings.length > 0) {
      lead.note(["🔍 Проверка: Доставка", ...lead.errors, ...lead.warnings].join("\n"));
    }
    if (lead.errors.length > 0) return;

    try {
      const pdf = await this.pfd.invoice({
        order_id: lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) as string,
        customer_name: lead.contact.name,
        customer_phone: lead.contact.custom_fields.get(AMO.CONTACT.PHONE),
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

  private validation(lead: LeadHelper, fields: string[]) {
    const errors_check: Record<string, [boolean, string]> = {
      delivery_type_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) ? true : false,
        "❌ Не выбран тип доставки",
      ],
      delivery_type_cdek_or_post: [
        ["Экспресс по России", "Почта России"].includes(
          lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
        ),
        "❌ Неверный тип доставки",
      ],
      delivery_type_courier: [
        ["Курьером (в пределах МКАД)", "Курьером (Московская область)"].includes(
          lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
        ),
        "❌ Неверный тип доставки",
      ],
      email_exists: [
        lead.contact.custom_fields.get(AMO.CONTACT.EMAIL) ? true : false,
        "❌ У контакта не указан email",
      ],
      phone_exists: [
        lead.contact.custom_fields.get(AMO.CONTACT.PHONE) ? true : false,
        "❌ У контакта не указан телефон",
      ],
      order_number_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) ? true : false,
        "❌ Не указан номер заказа",
      ],
      goods_exists: [lead.goods.size > 0 ? true : false, "❌ В сделке нет товаров"],
      name_exists: [lead.contact.name && lead.contact.name !== "", "❌ Не указано ФИО"],
    };

    const warnings_check: Record<string, [boolean, string]> = {
      index_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.INDEX) ? true : false,
        "⚠️ Не указан индекс",
      ],
      city_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.CITY) ? true : false,
        "⚠️ Не указан город",
      ],
      street_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.STREET) ? true : false,
        "⚠️ Не указана улица",
      ],
      building_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.BUILDING) ? true : false,
        "⚠️ Не указан дом",
      ],
      flat_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.FLAT) ? true : false,
        "⚠️ Не указана квартира",
      ],
      delivery_cost_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_COST) ? true : false,
        "⚠️ Не указана стоимость доставки",
      ],
      prepay_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY) ? true : false,
        "⚠️ Не указана предоплата",
      ],
    };

    for (const [key, value] of Object.entries(errors_check)) {
      if (fields.includes(key) && !value[0]) {
        lead.error(value[1]);
      }
    }

    for (const [key, value] of Object.entries(warnings_check)) {
      if (fields.includes(key) && !value[0]) {
        lead.warning(value[1]);
      }
    }
  }
}
