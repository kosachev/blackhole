import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";
import { LeadHelper } from "../helpers/lead.helper";
import { generateSku } from "../helpers/sku.helper";
import { AMO } from "../amo.constants";
import { stringDate } from "../../utils/timestamp.function";
import { type SalesEntryColor, SalesSheet } from "../../google-sheets/sales.sheet";
import { type EntityOperation } from "cdek/src/types/api/base";

@Injectable()
export class LeadStatusWebhook extends AbstractWebhook {
  async handle(data: unknown) {
    const lead = await LeadHelper.createFromWebhook(this.amo, data, {
      load_goods: true,
      load_contact: true,
    });

    this.logger.log(`LEAD_STATUS, lead_id: ${lead.data.id}, status_id: ${lead.data.status_id}`);

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
      case AMO.STATUS.POST: {
        await this.statusPost(lead);
        break;
      }
      case AMO.STATUS.CDEK: {
        await this.statusCdek(lead);
        break;
      }
      case AMO.STATUS.SENT: {
        await this.statusSent(lead);
        break;
      }
      case AMO.STATUS.CLOSED: {
        await this.statusClosed(lead);
        break;
      }
      case AMO.STATUS.SUCCESS: {
        await this.statusSuccess(lead);
        break;
      }
      case AMO.STATUS.IN_WORK: {
        this.statusInWork(lead);
        break;
      }
      case AMO.STATUS.CALLBACK: {
        this.statusCallback(lead);
        break;
      }
      case AMO.STATUS.WAITING: {
        this.statusWaiting(lead);
        break;
      }
    }

    await lead.saveToAmo();
  }

  private async statusRequisite(lead: LeadHelper) {
    this.validation({
      lead,
      errors: [
        "delivery_type_exists",
        "payment_not_equired",
        "email_exists",
        "phone_exists",
        "name_exists",
        "goods_exists",
        "order_number_exists",
        "city_exists",
        "street_exists",
        "building_exists",
        "prepay_valid_amount",
        "payment_status",
      ],
      warnings: ["index_exists"],
    });

    if (lead.errors.length > 0 || lead.warnings.length > 0) {
      lead.note(["🔍 Статус: Реквизиты", ...lead.errors, ...lead.warnings].join("\n"));
    }
    if (lead.errors.length > 0) return;

    // we check it on validation step
    const prepay = +lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY);

    if (lead.data.name.includes("ТЕСТ")) {
      const payment = await this.tbankService
        .initPayment({
          orderId: this.generatePaymentOrderId(lead),
          amount: prepay,
          description: `Предоплата заказа ${lead.data.id}`,
        })
        .catch(async (err) => {
          this.logger.error(
            `PAYMENT_INIT_ERROR, leadId:  ${lead.data.id}, err: ${err.message}`,
            undefined,
            "TBankService",
          );
          lead.note(`❌ Банк: Не удалось создать платеж\n${err.message}`);
          return null;
        });

      if (payment === null || !payment.PaymentURL) return;

      lead.note(`✅ Банк: Платеж создан (${payment.Status})
PaymentURL: ${payment.PaymentURL}
PaymentId: ${payment.PaymentId}
OrderId: ${payment.OrderId}
Сумма: ${payment.Amount / 100} руб.`);

      lead.custom_fields.set(AMO.CUSTOM_FIELD.BANK_STATUS, payment.Status ?? "unknown");
      lead.custom_fields.set(AMO.CUSTOM_FIELD.BANK_ORDERID, payment.OrderId ?? "unknown");
      lead.custom_fields.set(AMO.CUSTOM_FIELD.BANK_PAYMENTID, payment.PaymentId ?? "unknown");
      lead.custom_fields.set(AMO.CUSTOM_FIELD.BANK_PAYMENTURL, payment.PaymentURL ?? "unknown");

      await lead.saveToAmo();

      try {
        await Promise.all([
          this.mail.invoiceV2({
            name: lead.contact.name,
            address: lead.getFullAddress(true),
            phone: lead.contact.custom_fields.get(AMO.CONTACT.PHONE),
            email: lead.contact.custom_fields.get(AMO.CONTACT.EMAIL),
            delivery_type: lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
            order_number: lead.data.id.toString(),
            goods: [...lead.goods.values()].map((good) => ({
              name: good.name,
              quantity: good.quantity,
              price: good.price,
            })),
            total_price: lead.totalPrice(),
            discount: lead.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT) as string,
            prepayment: prepay,
            PaymentURL: payment.PaymentURL,
            is_gerdacollection: lead.tags.has(AMO.TAG.TILDA),
          }),
          this.amo.salesbot.runTask([
            {
              bot_id: AMO.SALESBOT.PAYMENT_URL,
              entity_id: lead.data.id,
              entity_type: 2,
            },
          ]),
        ]);

        lead.note("✅ email: письмо с платежной ссылкой отправлено");
        this.logger.log(`STATUS_REQUISITE, lead_id: ${lead.data.id}, mail sent`);
      } catch (err) {
        this.logger.error(err);
        lead.note("❌ email: ошибка при отправке письма с платежной ссылкой");
      }
    } else {
      try {
        await this.mail.invoice({
          name: lead.contact.name,
          address: lead.getFullAddress(true),
          phone: lead.contact.custom_fields.get(AMO.CONTACT.PHONE),
          email: lead.contact.custom_fields.get(AMO.CONTACT.EMAIL),
          delivery_type: lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
          order_number: lead.data.id.toString(),
          goods: [...lead.goods.values()].map((good) => ({
            name: good.name,
            quantity: good.quantity,
            price: good.price,
          })),
          total_price: lead.totalPrice(),
          discount: lead.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT) as string,
          prepayment: prepay,
        });

        lead.note("✅ email: письмо с реквизитами отправлено");
        this.logger.log(`STATUS_REQUISITE, lead_id: ${lead.data.id}, mail sent`);
      } catch (err) {
        this.logger.error(err);
        lead.note("❌ email: ошибка при отправке письма с реквизитами");
      }
    }
  }

  private generatePaymentOrderId(lead: LeadHelper): string {
    const orderId = lead.custom_fields.get(AMO.CUSTOM_FIELD.BANK_ORDERID);
    if (!orderId) return lead.data.id.toString();
    const parts = orderId.split("-");
    if (parts.length > 1) {
      return `${lead.data.id}-${+parts[1] + 1}`;
    } else {
      return `${lead.data.id}-1`;
    }
  }

  private async statusPayment(lead: LeadHelper) {
    this.validation({ lead, errors: ["email_exists", "order_number_exists"] });

    if (lead.errors.length > 0) {
      lead.note(["🔍 Статус: Оплата", ...lead.errors].join("\n"));
      return;
    }

    try {
      await this.mail.prepaymentConfirm({
        email: lead.contact.custom_fields.get(AMO.CONTACT.EMAIL),
        order_number: lead.data.id.toString(),
        is_gerdacollection: lead.tags.has(AMO.TAG.TILDA),
      });

      lead.note("✅ email: письмо с подтверждением оплаты отправлено");
      this.logger.log(`STATUS_PAYMENT, lead_id: ${lead.data.id}, mail sent`);
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ email: ошибка при отправке письма с подтверждением оплаты");
    }
  }

  private async statusDelivery(lead: LeadHelper) {
    this.validation({
      lead,
      errors: [
        "delivery_type_exists",
        "delivery_type_courier",
        "phone_exists",
        "goods_exists",
        "order_number_exists",
        "city_exists",
        "street_exists",
        "building_exists",
        "price_greater_than_zero",
      ],
      warnings: ["flat_exists", "delivery_time_exists", "discount_is_percent"],
    });

    if (lead.errors.length > 0 || lead.warnings.length > 0) {
      lead.note(["🔍 Статус: Доставка", ...lead.errors, ...lead.warnings].join("\n"));
    }
    if (lead.errors.length > 0) return;

    const delivery_cost = Number(lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_COST) as string);

    try {
      const pdf = await this.pdf.invoice({
        order_id: lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) as string,
        customer_name: lead.contact.name,
        customer_phone: lead.contact.custom_fields.get(AMO.CONTACT.PHONE),
        customer_address: lead.getFullAddress(),
        delivery_time: lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TIME) as string,
        payment_type: lead.custom_fields.get(AMO.CUSTOM_FIELD.PAY_TYPE) as string,
        goods: [...lead.goods.values()].map((good) => ({
          name: good.name,
          price: Math.round(good.price * lead.getDiscountMultiplyier()),
          quantity: good.quantity,
        })),
        delivery_cost: isNaN(delivery_cost) ? undefined : delivery_cost,
        discount:
          lead.getDiscountMultiplyier() < 1
            ? lead.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT)
            : undefined,
      });

      const yadisk_url = await this.yadisk.upload(
        `Товарный_чек_${lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID)}.pdf`,
        Buffer.from(pdf),
      );

      if (!yadisk_url) throw new Error("Yadisk: can't upload file");

      lead.note(`✎ Сформирован товарный чек: ${yadisk_url}`);
      this.logger.log(`STATUS_DELIVERY, lead_id: ${lead.data.id}, pdf: ${yadisk_url}`);
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ Товарный чек: ошибка при создании");
    }
  }

  private async statusPost(lead: LeadHelper) {
    this.validation({
      lead,
      errors: ["delivery_type_exists", "delivery_type_post", "name_exists", "index_is_number"],
      warnings: ["city_exists", "street_exists", "building_exists", "flat_exists"],
    });

    if (lead.errors.length > 0 || lead.warnings.length > 0) {
      lead.note(["🔍 Статус: Почта", ...lead.errors, ...lead.warnings].join("\n"));
    }
    if (lead.errors.length > 0) return;

    const phone = Number(lead.getStripedPhone());
    const price = lead.totalPrice();

    try {
      const pdf = await this.pdf.post7p112ep({
        recipient: lead.contact.name,
        recipient_address: lead.getFullAddress(),
        recipient_index: Number(lead.custom_fields.get(AMO.CUSTOM_FIELD.INDEX)),
        recipient_phone: isNaN(phone) ? undefined : phone,
        sum: price,
        sum_cash_on_delivery:
          price -
          lead.getAbsoluteDiscount() +
          Number(
            ((lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_COST) as string) ?? "0").split(
              ",",
            )[0],
          ) -
          Number(
            ((lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY) as string) ?? "0").split(",")[0],
          ),
      });

      const yadisk_url = await this.yadisk.upload(
        `Почтовый_бланк_${lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID)}.pdf`,
        Buffer.from(pdf),
      );

      lead.note(`✎ Сформирован почтовый бланк: ${yadisk_url}`);
      this.logger.log(`STATUS_POST, lead_id: ${lead.data.id}, pdf: ${yadisk_url}`);
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ Почтовый бланк: ошибка при создании");
    }
  }

  private async statusSent(lead: LeadHelper) {
    this.validation({
      lead,
      errors: [
        "delivery_type_exists",
        "delivery_type_cdek_or_post",
        "order_number_exists",
        "track_number_exists",
      ],
    });

    if (lead.errors.length > 0 || lead.warnings.length > 0) {
      lead.note(["🔍 Статус: Отправлено", ...lead.errors, ...lead.warnings].join("\n"));
    }
    if (lead.errors.length > 0) return;

    const deliveryType = lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE);

    if (deliveryType === "Авито") {
      await this.addLeadToGoogleSheets(lead, "Отправлено");
      return;
    }

    if (deliveryType === "Почта России") {
      await this.addLeadToGoogleSheets(lead, "Отправлено");
    }

    try {
      await this.mail.orderSend({
        delivery_type: lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
        email: lead.contact.custom_fields.get(AMO.CONTACT.EMAIL) as string,
        order_number: lead.data.id.toString(),
        track_code: lead.custom_fields.get(AMO.CUSTOM_FIELD.TRACK_NUMBER) as string,
        is_gerdacollection: lead.tags.has(AMO.TAG.TILDA),
      });

      lead.note("✅ email: письмо с трек-кодом отправлено");
      this.logger.log(`STATUS_SENT, lead_id: ${lead.data.id}, mail sent`);
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ email: ошибка при отправке письма с трек-кодом");
    }
  }

  private async statusCdek(lead: LeadHelper) {
    this.validation({
      lead,
      errors: [
        "delivery_type_cdek",
        "order_number_exists",
        "index_exists",
        "city_exists",
        "street_exists",
        "building_exists",
        "name_exists",
        "phone_exists",
        "email_exists",
        "goods_exists",
        "delivery_tariff_picked",
        "pvz_exists",
      ],
    });

    if (lead.errors.length > 0) {
      lead.note(["🔍 Статус: СДЭК", ...lead.errors].join("\n"));
      return;
    }

    const [length, width, height] = this.config
      .get<string>("CDEK_DEFAULT_PARCEL_SIZE")
      .split("x")
      .map(Number);

    const discount = lead.getDiscountMultiplyier();

    const is_pvz = [
      "Склад - Склад",
      "Дверь - Склад",
      "Склад - Склад эконом",
      "Дверь - Склад эконом",
    ].includes((lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TARIFF) as string) ?? "");

    try {
      const order = {
        type: 1,
        number: lead.data.id.toString(),
        tariff_code: lead.parseTariff(),
        comment: `заказ ${lead.data.id}`,
        delivery_recipient_cost: { value: 0 },
        sender: {
          name: this.config.get<string>("OWNER_SELLER_NAME"),
          phones: [
            {
              number: `+7${this.config.get<string>("OWNER_NOTIFICATION_PHONE")}`,
            },
          ],
        },
        recipient: {
          name: lead.contact.name,
          phones: [{ number: `+7${lead.getStripedPhone()}` }],
        },
        from_location: {
          postal_code: this.config.get<string>("OWNER_POST_INDEX"),
          country_code: "ru",
          address: this.config.get<string>("OWNER_SHOP_ADDRESS"),
        },
        to_location: !is_pvz
          ? {
              postal_code: lead.custom_fields.get(AMO.CUSTOM_FIELD.INDEX) as string,
              country_code: "ru",
              address: lead.getFullAddress(),
            }
          : undefined,
        delivery_point: is_pvz
          ? ((lead.custom_fields.get(AMO.CUSTOM_FIELD.PVZ) as string) ?? "")
              .replaceAll("[", "")
              .replaceAll("]", "")
              .trim()
          : undefined,
        services: [
          { code: "TRYING_ON" },
          { code: "INSURANCE", parameter: lead.data.price.toString() },
        ],
        packages: [
          {
            number: lead.data.id.toString(),
            weight: [...lead.goods.values()].reduce(
              (acc, item) =>
                acc + (item.weight ?? Number(this.config.get<number>("CDEK_DEFAULT_WEIGHT"))),
              0,
            ),
            length: length,
            width: width,
            height: height,
            comment: lead.data.name,
            items: [...lead.goods.values()].map((good) => ({
              name: good.name,
              ware_key: good.sku ?? generateSku(good.name),
              amount: good.quantity,
              weight: good.weight ?? Number(this.config.get<number>("CDEK_DEFAULT_WEIGHT")),
              url: this.config.get<string>("AMO_REDIRECT_URI"),
              cost: good.price,
              payment: {
                value:
                  Number(lead.custom_fields.get(AMO.CUSTOM_FIELD.FULLPAY) ?? "0") > 0
                    ? 0
                    : good.price * discount,
              },
            })),
          },
        ],
      };

      if (lead.goods.size > 1) {
        order.services.push({ code: "PART_DELIV" });
      }

      const res = await this.cdek.addOrder(order);

      if (res.requests[0].errors?.length > 0 || res.requests[0].state !== "ACCEPTED") {
        lead.note(
          `❌ СДЭК: ошибки при создании заказа\n${res.requests[0].errors?.map((err) => err.message)}`.trim(),
        );
        this.logger.error(
          `STATUS_CDEK, lead_id: ${lead.data.id}, error: ${res.requests[0].errors?.map((err) => err.message)}`,
        );
      } else {
        lead.note(
          `✎ СДЭК: создан заказ на доставку${is_pvz ? " в ПВЗ" : ""} по тарифу ${lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TARIFF) as string}`,
        );
        lead.custom_fields.set(AMO.CUSTOM_FIELD.CDEK_UUID, res.entity.uuid);
        this.logger.log(`STATUS_CDEK, lead_id: ${lead.data.id}, cdek_uuid: ${res.entity.uuid}`);

        await this.checkOrderValidation(lead, res);
      }
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ СДЭК: не удалось создать заказ в сдэк");
    }
  }

  private statusInWork(lead: LeadHelper) {
    this.setOrderFromLeadId(lead);
  }

  private statusCallback(lead: LeadHelper) {
    this.setOrderFromLeadId(lead);
  }

  private statusWaiting(lead: LeadHelper) {
    this.setOrderFromLeadId(lead);
  }

  private async checkOrderValidation(lead: LeadHelper, order: EntityOperation) {
    const timer = setTimeout(async () => {
      const res = await this.cdek.getOrderByUUID(order.entity.uuid);

      if (res.requests.at(0)?.state === "INVALID") {
        await this.amo.note.addNotes("leads", [
          {
            entity_id: lead.data.id,
            note_type: "common",
            params: {
              text: `❌ СДЭК: заказ не прошел валидацию\n${res.requests
                .at(0)
                ?.errors?.map((err) => err.message)
                .join("\n")}`,
            },
          },
        ]);

        this.logger.error(
          `CDEK_ORDER_VALIDATION, lead_id: ${lead.data.id}, uuid: ${order.entity.uuid}, error: ${res.requests[0].errors?.map((err) => err.message)}`,
        );
      }
    }, 15 * 1000); // 15 seconds

    this.cdek_service.setOrderValidationToTimer(lead.data.id.toString(), timer);
  }

  private async setOrderFromLeadId(lead: LeadHelper) {
    if (!lead.custom_fields.has(AMO.CUSTOM_FIELD.ORDER_ID)) {
      lead.custom_fields.set(AMO.CUSTOM_FIELD.ORDER_ID, lead.data.id.toString());
      lead.note(`✅ Номер заказа → ID сделки ${lead.data.id.toString()}`);
    }
  }

  private async statusClosed(lead: LeadHelper) {
    if (lead.data.pipeline_id === AMO.PIPELINE.RETURN) {
      const loss_reason = lead.tags.has(AMO.TAG.RETURN)
        ? AMO.LOSS_REASON.CDEK_RETURN
        : lead.tags.has(AMO.TAG.PARTIAL_RETURN)
          ? AMO.LOSS_REASON.CDEK_PARTIAL_RETURN
          : undefined;

      if (loss_reason) {
        lead.data.loss_reason_id = loss_reason;
      }
    }
  }

  private async statusSuccess(lead: LeadHelper) {
    const counter = lead.custom_fields.get(AMO.CUSTOM_FIELD.AD_COUNTER);

    if (counter && !isNaN(Number(counter))) {
      const data = {
        DateTime: Math.round(Date.now() / 1000) - 10,
        Price: lead.data.price,
        Currency: "RUB",
      };

      const yclid = lead.custom_fields.get(AMO.CUSTOM_FIELD.AD_YD_YCLID);
      const client_id = lead.custom_fields.get(AMO.CUSTOM_FIELD.AD_YM_CLIENT_ID);

      let ymtype: string;

      try {
        if (yclid) {
          await this.yametrika.upload(
            Number(counter),
            { Yclid: yclid, Target: "implemented", ...data },
            `AmoCRM ID:${lead.data.id} YD`,
          );
          ymtype = `Yclid: ${yclid}`;
        } else if (client_id) {
          await this.yametrika.upload(
            Number(counter),
            { ClientId: client_id, Target: "purchase", ...data },
            `AmoCRM ID:${lead.data.id} YM`,
          );
          ymtype = `ClientId: ${client_id}`;
        }

        if (ymtype) {
          this.logger.log(`YANDEX_METRIKA, counter ${counter}, ${ymtype}`);
          lead.note(`✅ Яндекс Метрика: данные загружены, счётчик ${counter} (${ymtype})`);
        }
      } catch (error) {
        this.logger.error(error);
        lead.note(`❌ Яндекс Метрика: не удалось отправить данные - ${(error as Error).message}`);
      }
    }

    const deliveryType = lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE);

    if (
      deliveryType === "Самовывоз" ||
      deliveryType === "Курьером (в пределах МКАД)" ||
      deliveryType === "Курьером (Московская область)"
    ) {
      await this.addLeadToGoogleSheets(lead, undefined, SalesSheet.colors.lightGreen);
    } else if (deliveryType === "Авито" || deliveryType === "Почта России") {
      try {
        const result = await this.googleSheets.sales.cdekFullSuccess(
          lead.data.id.toString(),
          lead.custom_fields.get(AMO.CUSTOM_FIELD.PAY_TYPE),
        );

        lead.note(
          result.updatedEntries > 0
            ? `✅ Google Sheets: обновлено строк - ${result.updatedEntries}`
            : `⚠️ Google Sheets: 0 строк обновлено`,
        );

        if (result.updatedEntries > 0) {
          this.logger.log(
            `UPDATE_LEAD, leadId: ${lead.data.id}, found entries: ${result.foundEntries}, updated entries: ${result.updatedEntries}`,
            "GoogleSheets",
          );
        } else {
          this.logger.warn(
            `UPDATE_LEAD, leadId: ${lead.data.id}, found entries: ${result.foundEntries}, updated entries: ${result.updatedEntries}`,
            "GoogleSheets",
          );
        }
      } catch (error) {
        this.logger.error(
          `UPDATE_LEAD_ERROR, leadId: ${lead.data.id}, error: ${(error as Error).message}`,
          "GoogleSheets",
        );
        lead.note(`❌ Google Sheets: Ошибка при обновлении сделки\n${(error as Error).message}`);
      }
    }
  }

  private validation({
    lead,
    errors,
    warnings,
  }: {
    lead: LeadHelper;
    errors?: string[];
    warnings?: string[];
  }) {
    const prepay = +lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY);
    const paymentStatus = lead.custom_fields.get(AMO.CUSTOM_FIELD.BANK_STATUS);

    const checks: Record<string, [boolean, string]> = {
      delivery_type_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) ? true : false,
        "Не выбран тип доставки",
      ],
      delivery_type_cdek_or_post_or_avito: [
        ["Экспресс по России", "Почта России", "Авито"].includes(
          lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
        ),
        `Неверный тип доставки ${lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) ?? ""}, должен быть "Экспресс по России" или "Почта России" или "Авито"`,
      ],
      delivery_type_post: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) === "Почта России",
        `Неверный тип доставки ${lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) ?? ""}, должен быть "Почта России"`,
      ],
      delivery_type_cdek: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) === "Экспресс по России",
        `Неверный тип доставки ${lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) ?? ""}, должен быть "Экспресс по России"`,
      ],
      payment_not_equired: [
        ["Экспресс по России", "Почта России"].includes(
          lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
        ),
        `Оплата для типа доставки "${lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) ?? ""}" не требуется`,
      ],
      delivery_type_courier: [
        ["Курьером (в пределах МКАД)", "Курьером (Московская область)"].includes(
          lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
        ),
        `Неверный тип доставки "${lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) ?? ""}" для курьерской доставки, должен быть "Курьером (в пределах МКАД)" или "Курьером (Московская область)"`,
      ],
      email_exists: [
        lead.contact.custom_fields.get(AMO.CONTACT.EMAIL) ? true : false,
        "У контакта не указан email",
      ],
      phone_exists: [
        lead.contact.custom_fields.get(AMO.CONTACT.PHONE) ? true : false,
        "У контакта не указан телефон",
      ],
      order_number_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) ? true : false,
        "Не указан номер заказа",
      ],
      goods_exists: [lead.goods.size > 0 ? true : false, "В сделке нет товаров"],
      name_exists: [lead.contact.name && lead.contact.name !== "", "Не указано ФИО"],
      index_is_number: [
        Number(lead.custom_fields.get(AMO.CUSTOM_FIELD.INDEX)) ? true : false,
        "Некорректный индекс",
      ],
      index_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.INDEX) ? true : false,
        "Не указан индекс",
      ],
      city_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.CITY) ? true : false,
        "Не указан город",
      ],
      street_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.STREET) ? true : false,
        "Не указана улица",
      ],
      building_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.BUILDING) ? true : false,
        "Не указан дом",
      ],
      flat_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.FLAT) ? true : false,
        "Не указана квартира",
      ],
      delivery_cost_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_COST) ? true : false,
        "Не указана стоимость доставки",
      ],
      prepay_valid_amount: [
        !isNaN(prepay) && prepay > 1 && prepay < 100000,
        "Неверная сумма предоплаты",
      ],
      payment_status: [
        paymentStatus !== "NEW" && paymentStatus !== "CONFIRMED",
        `Для сделки уже есть ${paymentStatus === "NEW" ? "новый" : "подтвержденный"} платеж`,
      ],
      delivery_time_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TIME) ? true : false,
        "Не указано время доставки",
      ],
      discount_is_percent: [
        (lead.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT) as string)?.includes("%") ||
          !lead.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT),
        "Cкидка не учитывается, так как указана не в процентах",
      ],
      delivery_tariff_picked: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TARIFF) ? true : false,
        "Не выбран тариф доставки",
      ],
      pvz_exists: [
        !(
          [
            "Склад - Склад",
            "Дверь - Склад",
            "Склад - Склад эконом",
            "Дверь - Склад эконом",
          ].includes((lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TARIFF) as string) ?? "") &&
          !lead.custom_fields.get(AMO.CUSTOM_FIELD.PVZ)
        ),
        "Не выбран пункт выдачи",
      ],
      track_number_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.TRACK_NUMBER) ||
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) === "Авито"
          ? true
          : false,
        "Не указан трэк-код",
      ],
      price_greater_than_zero: [
        Number(lead.data.price) > 0 ? true : false,
        "Стоимость заказа не может быть меньше или равна нулю",
      ],
    };

    for (const [check_name, check_data] of Object.entries(checks)) {
      if (errors?.includes(check_name) && !check_data[0]) {
        lead.error(`❌ ${check_data[1]}`);
      }
      if (warnings?.includes(check_name) && !check_data[0]) {
        lead.warning(`⚠️ ${check_data[1]}`);
      }
    }
  }

  private async addLeadToGoogleSheets(
    lead: LeadHelper,
    status?: string,
    color?: SalesEntryColor,
  ): Promise<void> {
    try {
      const site = lead.tags.has(AMO.TAG.SITE)
        ? "Gerda"
        : lead.tags.has(AMO.TAG.TILDA)
          ? "gerdacollection"
          : undefined;

      const result = await this.googleSheets.sales.addLead({
        shippingDate: stringDate(),
        status,
        goods: [...lead.goods.values()],
        discount: lead.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT),
        customerDeliveryPrice: +(lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_COST) ?? "0"),
        cdekNumber: lead.custom_fields.get(AMO.CUSTOM_FIELD.TRACK_NUMBER),
        deliveryType: lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE),
        paymentType: lead.custom_fields.get(AMO.CUSTOM_FIELD.PAY_TYPE),
        leadId: lead.data.id.toString(),
        ads: lead.custom_fields.get(AMO.CUSTOM_FIELD.AD_UTM_SOURCE),
        site,
        color,
      });

      lead.note(
        result.addedEntries > 0
          ? `✅ Google Sheets: добавлено строк - ${result.addedEntries}`
          : `⚠️ Google Sheets: не добавлено новых строк`,
      );

      if (result.addedEntries > 0) {
        this.logger.log(
          `ADD_LEAD, leadId: ${lead.data.id}, added entries: ${result.addedEntries}`,
          "GoogleSheets",
        );
      } else {
        this.logger.warn(
          `ADD_LEAD, leadId: ${lead.data.id}, added entries: ${result.addedEntries}`,
          "GoogleSheets",
        );
      }
    } catch (error) {
      this.logger.error(
        `ADD_LEAD_ERROR, leadId: ${lead.data.id}, error: ${(error as Error).message}`,
        (error as Error).stack,
        "GoogleSheets",
      );
      lead.note(`❌ Google Sheets: Ошибка при добавлении сделки\n${(error as Error).message}`);
    }
  }
}
