import { UpdateOrderStatus } from "cdek/src/types/api/webhook";

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { EntityLink, Task } from "@shevernitskiy/amo";
import { AbstractWebhook } from "./abstract.webhook";
import { AMO } from "../../amo/amo.constants";
import { stringDate, timestamp } from "../../utils/timestamp.function";
import { LeadHelper } from "../../amo/helpers/lead.helper";
import { type RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";
import { type SalesUpdateResult } from "../../google-sheets/sales.sheet";

const status_reason_code = {
  "1": " по причине неверного адреса (1)",
  "2": " по причине недозвона (2)",
  "3": " по причине не проживания адресата (3)",
  "4": " по причине вес отличается от заявленного (4)",
  "5": " по причине фактического отсутсвия отправителя (5)",
  "6": " по причине дубля номера заказа в одном акте (6)",
  "7": " по причине невозможности доставки в данный город (7)",
  "8": " по причине повреждения упаковки при приемки от отправителя (8)",
  "9": " по причине повреждения упаковки у перевозчика (9)",
  "10": " по причине повреждения упаковки на складе СДЭК / у курьера (10)",
  "11": " по причине отказа без объяснения (11)",
  "12": " по причине отказа из-за претензии к качеству товара (12)",
  "13": " по причине отказа из-за недовложения (13)",
  "14": " по причине отказа из-за пересорта (14)",
  "15": " по причине отказа из-за того, что не устроили сроки (15)",
  "16": " по причине отказа из-за того, что получатель уже купил (16)",
  "17": " по причине отказа из-за того, что получатель передумал (17)",
  "18": " по причине отказа из-за ошибки оформления (18)",
  "19": " по причине отказа из-за повреждения упаковки у получателя (19)",
  "20": " по причине частичной доставки (20)",
  "21": " по причине отказа из-за отсутствия денег (21)",
  "22": " по причине отказа из-за того, что товар не подошел / не понравился (22)",
  "23": " по причине истечения срока хранения (23)",
  "24": " по причине непрохождения томожни (24)",
  "25": " по причине того, что заказ является коммерческим грузом (25)",
  "26": " по причине утери (26)",
  "27": " по причине не востребованности, утилизация (27)",
} as const;

const orderUrl = (cdek_number: string) => `https://lk.cdek.ru/order-history/${cdek_number}/view`;

type ParsedWebhook = {
  note?: string;
  tag: (typeof AMO.TAG)[keyof typeof AMO.TAG][];
  task?: Partial<Task>;
  status?: (typeof AMO.STATUS)[keyof typeof AMO.STATUS];
  pipeline?: number;
  loss_reason?: number;
  custom_fields: [number, string][];
  salesbot?: number;
};

@Injectable()
export class OrderStatusWebhook extends AbstractWebhook {
  async handle(data: UpdateOrderStatus) {
    if (!data?.attributes?.status_code || !data?.attributes?.cdek_number) return;
    if (data?.attributes?.is_return) {
      data.attributes.number = (await this.getLeadIdForReverseOrder(data)).toString();
    }
    if (!data?.attributes?.number || Number(data.attributes.number) <= 99999) return;

    const parsed = this.parse(data);

    this.logger.log(
      `CDEK_ORDER_STATUS, lead_id: ${data.attributes.number}, uuid: ${data.uuid}, trackcode: ${data.attributes.cdek_number}, code: ${data.attributes.status_code}, return: ${data.attributes.is_return}`,
    );

    const promises: Promise<unknown>[] = [
      this.amo.lead.updateLeadById(Number(data.attributes.number), {
        updated_at: Math.round(Date.now() / 1000),
        status_id: parsed.status,
        pipeline_id: parsed.pipeline,
        custom_fields_values: parsed.custom_fields.map((item) => ({
          field_id: item[0],
          values: [{ value: item[1] }],
        })),
        tags_to_add: parsed.tag.map((item) => ({ id: item })),
      }),
    ];

    if (parsed.note) {
      promises.push(
        this.amo.note.addNotes("leads", [
          {
            entity_id: Number(data.attributes.number),
            note_type: "common",
            params: {
              text: parsed.note,
            },
          },
        ]),
      );
    }

    if (parsed.task) {
      promises.push(this.amo.task.addTasks([parsed.task]));
    }

    if (parsed.salesbot) {
      promises.push(
        this.amo.salesbot.runTask([
          {
            bot_id: parsed.salesbot,
            entity_id: +data.attributes.number,
            entity_type: 2,
          },
        ]),
      );
    }

    await Promise.all(promises);
  }

  parse(data: UpdateOrderStatus): ParsedWebhook {
    const parsed: ParsedWebhook = {
      tag: [],
      custom_fields: [
        [
          AMO.CUSTOM_FIELD.CDEK_STATUS,
          `${data.attributes.status_code}${data.attributes.status_reason_code ? "/" + data.attributes.status_reason_code : ""}${data.attributes.city_name ? ", " + data.attributes.city_name : ""}, ${new Date().toLocaleString("ru-RU")}`,
        ],
      ],
    };
    const prefix = data.attributes.is_return ? " ВОЗВРАТ" : "";

    switch (data.attributes.status_code) {
      case "1":
        parsed.custom_fields.push(
          [AMO.CUSTOM_FIELD.TRACK_NUMBER, data.attributes.cdek_number],
          [AMO.CUSTOM_FIELD.CDEK_INVOICE_URL, orderUrl(data.attributes.cdek_number)],
        );
        parsed.note = `✎ СДЭК${prefix}: получен трек-код ${data.attributes.cdek_number}, накладная ${orderUrl(data.attributes.cdek_number)} (1)`;
        this.getPrintForm(data.attributes.cdek_number, +data.attributes.number);
        this.cdek_service.deleteOrderValidationToTimer(data.uuid);
        break;
      case "2":
        parsed.custom_fields.push(
          [AMO.CUSTOM_FIELD.TRACK_NUMBER, null],
          [AMO.CUSTOM_FIELD.CDEK_CITY_ID, null],
          [AMO.CUSTOM_FIELD.CDEK_PREIOD, null],
          [AMO.CUSTOM_FIELD.CDEK_UUID, null],
          [AMO.CUSTOM_FIELD.CDEK_INVOICE_URL, null],
          [AMO.CUSTOM_FIELD.CDEK_STATUS, null],
        );
        parsed.note = `✎ СДЭК${prefix}: заказ удалён (2)`;
        break;
      case "3":
        parsed.note = `ℹ СДЭК${prefix}: посылка принята на склад отправителя (3)`;
        parsed.status = data.attributes.is_return ? AMO.STATUS.RETURN : AMO.STATUS.SENT;

        if (!data.attributes.is_return) {
          this.addLeadToGoogleSheets(
            data.attributes.number,
            data.attributes.cdek_number,
            data.uuid,
          );
        }

        break;
      case "4":
        if (data.attributes.is_return) {
          parsed.task = {
            entity_id: +data.attributes.number,
            entity_type: "leads",
            complete_till: timestamp("plus_one_hour"),
            task_type_id: AMO.TASK.PROCESS,
            responsible_user_id: AMO.USER.ADMIN,
            text: "Осмотреть товар на повреждения. Принять возврат",
          };
          parsed.note = `✔ СДЭК${prefix}: возврат получен (4)`;
          parsed.status = AMO.STATUS.CLOSED;
          parsed.pipeline = AMO.PIPELINE.RETURN;
          this.cancelTasksByText(
            +data.attributes.number,
            "Возврат выдан на доставку курьеру. Принять возврат",
          );
          this.cdekReturnRecieved(data.attributes.number);
          break;
        }
        if (!data.attributes.status_reason_code) {
          parsed.note = `✔ СДЭК${prefix}: посылка успешно вручена адресату (4)`;
          parsed.status = AMO.STATUS.SUCCESS;
          this.cdekFullSuccess(data.attributes.number, data.uuid);
          break;
        }
        if (data.attributes.status_reason_code !== "20") break;
        parsed.note = `✔ СДЭК${prefix}: частичный выкуп товаров адресатом (4/20)`;
        parsed.tag.push(AMO.TAG.PARTIAL_RETURN);
        this.handlePartialReturn(data);
        break;
      case "5":
        parsed.note = `ℹ СДЭК${prefix}: посылка не вручена адресату (5)${status_reason_code[data.attributes.status_reason_code] ?? ""}\n⇌ СДЕК ВОЗВРАТ: Сделка переведена в возвраты`;
        parsed.tag.push(AMO.TAG.RETURN);
        parsed.status = AMO.STATUS.RETURN;
        parsed.pipeline = AMO.PIPELINE.RETURN;
        this.cdekFullReturn(data.attributes.number);
        break;
      case "6":
        parsed.status = data.attributes.is_return ? AMO.STATUS.RETURN : AMO.STATUS.SENT;
        break;
      case "7":
        parsed.status = data.attributes.is_return ? AMO.STATUS.RETURN : AMO.STATUS.SENT;
        break;
      case "10":
        parsed.note = `ℹ СДЭК${prefix}: посылка прибыла на склад города-получателя ${data.attributes.city_name ?? ""}, ожидает доставки до двери (10)`;
        break;
      case "11":
        parsed.note = `ℹ СДЭК${prefix}: посылка выдана на доставку (11)`;
        if (data.attributes.is_return) {
          parsed.task = {
            entity_id: +data.attributes.number,
            entity_type: "leads",
            complete_till: timestamp("today_ending"),
            task_type_id: AMO.TASK.PROCESS,
            responsible_user_id: AMO.USER.ADMIN,
            text: "Возврат выдан на доставку курьеру. Принять возврат",
          };
        }
        break;
      case "12":
        parsed.note = `ℹ СДЭК${prefix}: посылка прибыла на склад до востребования города-получателя ${data.attributes.city_name ?? ""}, ожидает забора клиентом (12)`;
        if (!data.attributes.is_return) {
          parsed.salesbot = AMO.SALESBOT.ORDER_AT_PVZ;
        }
        break;
      case "19":
        parsed.status = data.attributes.is_return ? AMO.STATUS.RETURN : AMO.STATUS.SENT;
        break;
    }

    return parsed;
  }

  async cancelTasksByText(lead_id: number, text: string): Promise<void> {
    const data = await this.amo.task.getTasks({
      filter: (filter) => filter.single("entity_id", lead_id),
    });

    const tasks_to_close = data._embedded.tasks
      .filter((task) => task.text === text)
      .map((task) => task.id);

    if (tasks_to_close.length > 0) {
      await this.amo.task.updateTasks(
        tasks_to_close.map((id) => ({
          id,
          is_completed: true,
          result: { text: "Задача отменена автоматически" },
        })),
      );
    }
  }

  async handlePartialReturn(data: UpdateOrderStatus): Promise<void> {
    const order = await this.cdek.getOrderByUUID(data.uuid);
    const direct_lead = await this.amo.lead.getLeadById(+data.attributes.number, {
      with: ["catalog_elements", "contacts"],
    });

    const direct_cat_els = await Promise.all(
      direct_lead._embedded.catalog_elements.map((item) =>
        this.amo.catalog.getCatalogElementById(item.id, AMO.CATALOG.GOODS),
      ),
    );

    const successSku: string[] = [];
    const returnSku: string[] = [];

    let return_total = 0;
    const return_goods: Partial<EntityLink>[] = [];

    // count return goods
    for (const item of order.entity?.packages?.[0]?.items) {
      const diff_amount = Math.abs(item.amount - (item.delivery_amount ?? item.amount));

      if (diff_amount === 0) {
        successSku.push(item.ware_key);
        continue; // all items sold
      }
      returnSku.push(item.ware_key);

      return_total += item.cost * diff_amount;

      // better to use warekey, bit is's not always be setted
      const catalog_element = direct_cat_els.find((el) => item.name === el.name);

      if (!catalog_element) {
        this.logger.error(`Can't find catalog element for ${item.name}`);
        continue;
      }

      return_goods.push({
        to_entity_id: catalog_element.id,
        to_entity_type: "catalog_elements",
        metadata: {
          catalog_id: AMO.CATALOG.GOODS,
          quantity: diff_amount,
        },
      });
    }

    // create return lead
    const return_lead = await this.amo.lead.addLeads([
      {
        status_id: AMO.STATUS.RETURN,
        pipeline_id: AMO.PIPELINE.RETURN,
        name: `Частичный возврат по сделке ${direct_lead.id}`,
        price: return_total,
        custom_fields_values: direct_lead.custom_fields_values,
        _embedded: {
          contacts: [{ id: direct_lead._embedded.contacts[0].id }],
          tags: [{ id: AMO.TAG.PARTIAL_RETURN }],
        },
      },
    ]);
    if (!return_lead) {
      throw new InternalServerErrorException("Unable to create return lead");
    }

    const paymentType = order.entity?.delivery_detail?.payment_info?.at(0)?.type;
    const paymentTitle =
      paymentType === "CARD" ? "Оплата картой" : paymentType === "CASH" ? "Наличные" : undefined;

    const directLeadUpdate: RequestUpdateLead = {
      status_id: AMO.STATUS.SUCCESS,
      price: direct_lead.price - return_total,
    };

    if (paymentTitle) {
      directLeadUpdate.custom_fields_values = [
        {
          field_id: AMO.CUSTOM_FIELD.PAY_TYPE,
          values: [{ value: paymentTitle }],
        },
      ];
    }
    // delete return goods from direct, add it to return lead
    await Promise.all([
      this.amo.link.deleteLinksByEntityId(direct_lead.id, "leads", return_goods),
      this.amo.link.addLinksByEntityId(return_lead._embedded.leads[0].id, "leads", return_goods),
      this.amo.lead.updateLeadById(direct_lead.id, directLeadUpdate),
      this.amo.note.addNotes("leads", [
        {
          entity_id: direct_lead.id,
          note_type: "common",
          params: {
            text: `✔ СДЕК: Сделка переведена в реализованные, частичный возврат по ссылке https://gerda.amocrm.ru/leads/detail/${return_lead._embedded.leads[0].id}`,
          },
        },
        {
          entity_id: return_lead._embedded.leads[0].id,
          note_type: "common",
          params: {
            text: `⇌ СДЕК ВОЗВРАТ: Частичный возврат по сделке https://gerda.amocrm.ru/leads/detail/${direct_lead.id}`,
          },
        },
      ]),
    ]);

    this.cdekPartialReturn(
      data.attributes.number,
      return_lead._embedded.leads[0].id.toString(),
      successSku,
      returnSku,
      paymentTitle,
    );

    this.logger.log(
      `CDEK_PARTIAL_RETURN, direct_id: ${direct_lead.id}, return_id: ${return_lead._embedded.leads[0].id}`,
    );
  }

  private async getReturnLeadByCdekUUID(uuid: string): Promise<number | undefined> {
    const result = await this.amo.lead.getLeads({
      query: uuid,
    });

    const lead = result?._embedded?.leads?.find(
      (item) => item.status_id === AMO.STATUS.RETURN && item.pipeline_id === AMO.PIPELINE.RETURN,
    );

    return lead?.id;
  }

  async getLeadIdForReverseOrder(data: UpdateOrderStatus): Promise<number> {
    // if return lead with uuid exists -> return lead id
    const lead_by_return_id = await this.getReturnLeadByCdekUUID(data.uuid);
    if (lead_by_return_id) return lead_by_return_id;

    // if partial return lead exists without uuid -> return lead id, update data
    if (!data.attributes.related_entities?.at(0)?.uuid) {
      throw new InternalServerErrorException("Not found related entity uuid in reverse order");
    }
    const lead_by_direct_uuid = await this.getReturnLeadByCdekUUID(
      data.attributes.related_entities[0].uuid,
    );
    if (!lead_by_direct_uuid) {
      await this.telegram.textToAdmin(
        `Для возвратного заказа сдэка ${data.attributes.cdek_number} не найдено сделок по прямом и обратному uuid`,
      );
      throw new InternalServerErrorException("Not found lead for direct and  reverse uuid");
    }
    const reverse_order = await this.cdek.getOrderByUUID(data.uuid);

    const reverse_price = reverse_order.entity?.delivery_detail?.delivery_sum ?? 0;
    await Promise.all([
      this.amo.lead.updateLeadById(lead_by_direct_uuid, {
        custom_fields_values: [
          {
            field_id: AMO.CUSTOM_FIELD.CDEK_RETURN_UUID,
            values: [{ value: data.uuid }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.CDEK_RETURN_INVOICE,
            values: [{ value: data.attributes.cdek_number }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.CDEK_RETURN_PRICE,
            values: [{ value: reverse_price.toString() }],
          },
        ],
      }),
      this.amo.note.addNotes("leads", [
        {
          entity_id: lead_by_direct_uuid,
          note_type: "common",
          params: {
            text: `ℹ СДЕК ВОЗВРАТ\nВозвратный UUID: ${data.uuid}\nВозвратная накладная: ${orderUrl(data.attributes.cdek_number)}${reverse_price ? `\nСтоимость доставки: ${reverse_price}` : ""}`,
          },
        },
      ]),
    ]);

    this.cdekReturnCdekNumberAndDeliveryPrice(
      lead_by_direct_uuid.toString(),
      reverse_order.entity.cdek_number,
      reverse_price,
    );

    return lead_by_direct_uuid;
  }

  private async getPrintForm(cdek_number: string, lead_id: number): Promise<void> {
    try {
      const printRequest = await this.cdek.createOrderReceipt({
        orders: [{ cdek_number: +cdek_number }],
        copy_count: 1,
      });

      if (!printRequest.entity?.uuid) {
        throw new Error(`cannot create print form, cdek_number: ${cdek_number}`);
      }

      this.cdek_service.setPrintformToLead(printRequest.entity.uuid, {
        leadId: lead_id,
        cdekNumber: cdek_number,
      });
    } catch (error) {
      this.logger.error("CDEK_CREATE_PRINT_FORM_ERROR", error.message);
      await this.amo.note.addNotes("leads", [
        {
          entity_id: lead_id,
          note_type: "common",
          params: {
            text: `❌ СДЕК: Ошибка при создании формы для накладной ${cdek_number}`,
          },
        },
      ]);
    }
  }

  private async addLeadToGoogleSheets(
    leadId: string,
    cdekNumber: string,
    uuid: string,
  ): Promise<void> {
    try {
      const [order, lead] = await Promise.all([
        this.cdek.getOrderByUUID(uuid),
        LeadHelper.createFromId(this.amo, +leadId, { load_goods: true }),
      ]);
      const deliverySum = order.entity?.delivery_detail?.delivery_sum ?? 0;

      const result = await this.googleSheets.sales.addLead({
        shippingDate: stringDate(),
        status: "Отправлено",
        goods: [...lead.goods.values()],
        discount: lead.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT),
        customerDeliveryPrice: +(lead.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_COST) ?? "0"),
        ownerDeliveryPrice: deliverySum,
        deliveryType: `СДЭК ${lead.custom_fields.get(AMO.CUSTOM_FIELD.CITY) ?? ""}`.trim(),
        paymentType: lead.custom_fields.get(AMO.CUSTOM_FIELD.PAY_TYPE),
        leadId: leadId,
        cdekNumber: cdekNumber,
        ads: lead.custom_fields.get(AMO.CUSTOM_FIELD.AD_UTM_SOURCE),
      });

      await Promise.all([
        this.amo.lead.updateLeadById(+leadId, {
          custom_fields_values: [
            {
              field_id: AMO.CUSTOM_FIELD.CDEK_PRICE,
              values: [{ value: deliverySum.toString() }],
            },
          ],
        }),
        this.amo.note.addNotes("leads", [
          {
            entity_id: +leadId,
            note_type: "common",
            params: {
              text:
                result.addedEntries > 0
                  ? `✅ Google Sheets: добавлено строк - ${result.addedEntries}`
                  : `⚠️ Google Sheets: не добавлено новых строк при отправке заказа СДЭКом`,
            },
          },
        ]),
      ]);

      if (result.addedEntries > 0) {
        this.logger.log(
          `ADD_LEAD, leadId: ${leadId}, added entries: ${result.addedEntries}`,
          "GoogleSheets",
        );
      } else {
        this.logger.warn(
          `ADD_LEAD, leadId: ${leadId}, added entries: ${result.addedEntries}`,
          "GoogleSheets",
        );
      }
    } catch (error) {
      this.logger.error(
        `ADD_LEAD_ERROR, leadId: ${leadId}, error: ${error.message}`,
        "GoogleSheets",
      );
      await this.amo.note.addNotes("leads", [
        {
          entity_id: +leadId,
          note_type: "common",
          params: {
            text: `❌ Google Sheets: Ошибка при добавлении сделки\n${error.message}`,
          },
        },
      ]);
    }
  }

  private async cdekGoogleSheetsUpdate(
    leadId: string,
    operation: () => Promise<SalesUpdateResult>,
  ): Promise<void> {
    try {
      const result = await operation();

      const message =
        result.updatedEntries > 0
          ? `✅ Google Sheets: обновлено строк - ${result.updatedEntries}`
          : `⚠️ Google Sheets: 0 строк обновлено`;

      await this.amo.note.addNotes("leads", [
        {
          entity_id: +leadId,
          note_type: "common",
          params: {
            text: message,
          },
        },
      ]);

      this.logger.log(
        `UPDATE_LEAD, leadId: ${leadId}, found entries: ${result.foundEntries}, updated entries: ${result.updatedEntries}`,
        "GoogleSheets",
      );
    } catch (error) {
      this.logger.error(
        `UPDATE_LEAD_ERROR, leadId: ${leadId}, error: ${error.message}`,
        "GoogleSheets",
      );
      await this.amo.note.addNotes("leads", [
        {
          entity_id: +leadId,
          note_type: "common",
          params: {
            text: `❌ Google Sheets: Ошибка при обновлении сделки\n${error.message}`,
          },
        },
      ]);
    }
  }

  private async cdekFullSuccess(leadId: string, uuid: string): Promise<void> {
    const order = await this.cdek.getOrderByUUID(uuid);
    const paymentType = order.entity?.delivery_detail?.payment_info?.at(0)?.type;
    const paymentTitle =
      paymentType === "CARD" ? "Оплата картой" : paymentType === "CASH" ? "Наличные" : undefined;

    await this.cdekGoogleSheetsUpdate(leadId, () =>
      this.googleSheets.sales.cdekFullSuccess(leadId, paymentTitle),
    );

    if (paymentTitle) {
      await this.amo.lead.updateLeadById(+leadId, {
        custom_fields_values: [
          {
            field_id: AMO.CUSTOM_FIELD.PAY_TYPE,
            values: [{ value: paymentTitle }],
          },
        ],
      });
    }
  }

  private async cdekFullReturn(leadId: string): Promise<void> {
    await this.cdekGoogleSheetsUpdate(leadId, () => this.googleSheets.sales.cdekFullReturn(leadId));
  }

  private async cdekPartialReturn(
    leadId: string,
    returnLeadId: string,
    goodSkuSuccess: string[],
    goodSkuReturn: string[],
    paymentType?: string,
  ): Promise<void> {
    try {
      const result = await this.googleSheets.sales.cdekPartialReturn(
        leadId,
        returnLeadId,
        goodSkuSuccess,
        goodSkuReturn,
        paymentType,
      );

      const message =
        result.updatedEntries > 0
          ? `✅ Google Sheets: обновлено строк - ${result.updatedEntries}`
          : `⚠️ Google Sheets: 0 строк обновлено`;

      await this.amo.note.addNotes("leads", [
        {
          entity_id: +leadId,
          note_type: "common",
          params: {
            text: message,
          },
        },
        {
          entity_id: +returnLeadId,
          note_type: "common",
          params: {
            text: message,
          },
        },
      ]);

      this.logger.log(
        `UPDATE_LEAD, leadId: ${leadId}, returnLeadId: ${returnLeadId}, found entries: ${result.foundEntries}, updated entries: ${result.updatedEntries}`,
        "GoogleSheets",
      );
    } catch (error) {
      this.logger.error(
        `UPDATE_LEAD_ERROR, leadId: ${leadId}, returnLeadId: ${returnLeadId}, error: ${error.message}`,
        "GoogleSheets",
      );
      await this.amo.note.addNotes("leads", [
        {
          entity_id: +leadId,
          note_type: "common",
          params: {
            text: `❌ Google Sheets: Ошибка при обновлении сделки\n${error.message}`,
          },
        },
        {
          entity_id: +returnLeadId,
          note_type: "common",
          params: {
            text: `❌ Google Sheets: Ошибка при обновлении сделки\n${error.message}`,
          },
        },
      ]);
    }
  }

  private async cdekReturnCdekNumberAndDeliveryPrice(
    returnLeadId: string,
    returnCdekNumber: string,
    ownerReturnDeliveryPrice: number,
  ): Promise<void> {
    await this.cdekGoogleSheetsUpdate(returnLeadId, () =>
      this.googleSheets.sales.cdekReturnCdekNumberAndDeliveryPrice(
        returnLeadId,
        returnCdekNumber,
        ownerReturnDeliveryPrice,
      ),
    );
  }

  private async cdekReturnRecieved(returnLeadId: string): Promise<void> {
    await this.cdekGoogleSheetsUpdate(returnLeadId, () =>
      this.googleSheets.sales.cdekReturnRecieved(returnLeadId),
    );
  }
}
