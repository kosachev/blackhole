import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";
import { LeadHelper } from "../helpers/lead.helper";
import { generateSku } from "../helpers/sku.helper";
import { AMO } from "../amo.constants";

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
        "prepay_exists",
      ],
      warnings: ["index_exists"],
    });

    if (lead.errors.length > 0 || lead.warnings.length > 0) {
      lead.note(["🔍 Статус: Реквизиты", ...lead.errors, ...lead.warnings].join("\n"));
    }
    if (lead.errors.length > 0) return;

    let prepay = lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY)
      ? Number(lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY))
      : 0;
    if (isNaN(prepay)) prepay = 0;

    try {
      await this.mail.invoice({
        name: lead.contact.name,
        address: lead.getFullAddress(true),
        phone: lead.contact.custom_fields.get(AMO.CONTACT.PHONE),
        email: lead.contact.custom_fields.get(AMO.CONTACT.EMAIL),
        delivery_type: lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
        order_number: lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) as string,
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

  private async statusPayment(lead: LeadHelper) {
    this.validation({ lead, errors: ["email_exists", "order_number_exists"] });

    if (lead.errors.length > 0) {
      lead.note(["🔍 Статус: Оплата", ...lead.errors].join("\n"));
      return;
    }

    try {
      await this.mail.prepaymentConfirm({
        email: lead.contact.custom_fields.get(AMO.CONTACT.EMAIL),
        order_number: lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) as string,
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

    try {
      await this.mail.orderSend({
        delivery_type: lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
        email: lead.contact.custom_fields.get(AMO.CONTACT.EMAIL) as string,
        order_number: lead.custom_fields.get(AMO.CUSTOM_FIELD.ORDER_ID) as string,
        track_code: lead.custom_fields.get(AMO.CUSTOM_FIELD.TRACK_NUMBER) as string,
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
        comment: lead.data.name,
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

        setTimeout(async () => {
          const lead_new = await this.amo.lead.getLeadById(lead.data.id);
          if (!lead_new) {
            throw new Error("Lead not found");
          }
          const track_number = lead_new.custom_fields_values.find(
            (item) => item.field_id === AMO.CUSTOM_FIELD.TRACK_NUMBER,
          )?.values[0]?.value;
          if (!track_number || track_number === "") {
            this.cdekTrackcodeCheck(lead.data.id, res.entity.uuid, 1);
          }
        }, 10000);
      }
    } catch (err) {
      this.logger.error(err);
      lead.note("❌ СДЭК: не удалось создать заказ в сдэк");
    }
  }

  private cdekTrackcodeCheck(lead_id: number, uuid: string, attemps: number) {
    setTimeout(async () => {
      const res = await this.cdek.getOrderByUUID(uuid);

      if (
        res.requests[0].errors?.length > 0 ||
        res.entity.statuses.find((item) => item.code === "INVALID")
      ) {
        this.amo.note.addNotes("leads", [
          {
            entity_id: lead_id,
            note_type: "common",
            params: {
              text: `❌ СДЭК: ошибки при создании заказа при получении трэк-кода\n${res.requests[0].errors?.map((err) => err.message).join("\n")}`.trim(),
            },
          },
        ]);
        return;
      }

      if (res.entity.statuses.find((item) => item.code === "ACCEPTED")) {
        await Promise.all([
          this.amo.lead.updateLeadById(lead_id, {
            custom_fields_values: [
              {
                field_id: AMO.CUSTOM_FIELD.TRACK_NUMBER,
                values: [{ value: res.entity.cdek_number }],
              },
              {
                field_id: AMO.CUSTOM_FIELD.CDEK_INVOICE_URL,
                values: [
                  {
                    value: `https://lk.cdek.ru/print/print-order?numberOrd=${res.entity.cdek_number}`,
                  },
                ],
              },
            ],
          }),
          this.amo.note.addNotes("leads", [
            {
              entity_id: lead_id,
              note_type: "common",
              params: {
                text: `✎ СДЭК: получен трек-код ${res.entity.cdek_number}, накладная: https://lk.cdek.ru/print/print-order?numberOrd=${res.entity.cdek_number}`,
              },
            },
          ]),
        ]);
        return;
      }

      if (attemps <= 5) {
        attemps++;
        this.cdekTrackcodeCheck(lead_id, uuid, attemps);
      } else {
        this.amo.note.addNotes("leads", [
          {
            entity_id: lead_id,
            note_type: "common",
            params: {
              text: `❌ СДЭК: не удалось получить трек-код в течении 5 попыток`,
            },
          },
        ]);
      }
    }, 1000 * attemps);
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

  private async setOrderFromLeadId(lead: LeadHelper) {
    if (!lead.custom_fields.has(AMO.CUSTOM_FIELD.ORDER_ID)) {
      lead.custom_fields.set(AMO.CUSTOM_FIELD.ORDER_ID, lead.data.id.toString());
      lead.note(`✅ Номер заказа -> id сделки ${lead.data.id.toString()}`);
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
    // TODO: remove YM_COUNTER after adoption lead_create
    const counter =
      lead.custom_fields.get(AMO.CUSTOM_FIELD.COUNTER) ??
      lead.custom_fields.get(AMO.CUSTOM_FIELD.YM_COUNTER);
    if (!counter || isNaN(Number(counter))) return;

    const data = {
      Target: "purchase",
      DateTime: Math.round(Date.now() / 1000) - 10,
      Price: lead.data.price,
      Currency: "RUB",
    };

    const yclid = lead.custom_fields.get(AMO.CUSTOM_FIELD.YD_YCLID);
    const client_id = lead.custom_fields.get(AMO.CUSTOM_FIELD.YM_CLIENT_ID);

    let ymtype: string;

    try {
      if (yclid) {
        await this.yametrika.upload(
          Number(counter),
          { Yclid: yclid, ...data },
          `AmoCRM ID:${lead.data.id} YD`,
        );
        ymtype = `Yclid: ${yclid}`;
      } else if (client_id) {
        await this.yametrika.upload(
          Number(counter),
          { ClientId: client_id, ...data },
          `AmoCRM ID:${lead.data.id} YM`,
        );
        ymtype = `ClientId: ${client_id}`;
      }

      if (ymtype) {
        this.logger.log(`YANDEX_METRIKA, counter ${counter}, ${ymtype}`);
        lead.note(`✅ Яндекс Метрика: данные загружены, счётчик ${counter} (${ymtype})`);
      }
    } catch (err) {
      this.logger.error(err);
      lead.note(`❌ Яндекс Метрика: не удалось отправить данные - ${err.message}`);
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
    const checks: Record<string, [boolean, string]> = {
      delivery_type_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) ? true : false,
        "Не выбран тип доставки",
      ],
      delivery_type_cdek_or_post: [
        ["Экспресс по России", "Почта России"].includes(
          lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) as string,
        ),
        `Неверный тип доставки ${lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TYPE) ?? ""}, должен быть "Экспресс по России" или "Почта России"`,
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
      prepay_exists: [
        lead.custom_fields.get(AMO.CUSTOM_FIELD.PREPAY) ? true : false,
        "Не указана предоплата",
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
        lead.custom_fields.get(AMO.CUSTOM_FIELD.TRACK_NUMBER) ? true : false,
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
}
