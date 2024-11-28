import { UpdateOrderStatus } from "cdek/src/types/api/webhook";

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { EntityLink, Task } from "@shevernitskiy/amo";
import { AbstractWebhook } from "./abstract.webhook";
import { AMO } from "../../amo/amo.constants";
import { timestamp } from "../../utils/timestamp.function";

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

type ParsedWebhook = {
  note?: string;
  tag: (typeof AMO.TAG)[keyof typeof AMO.TAG][];
  task?: Partial<Task>;
  status?: (typeof AMO.STATUS)[keyof typeof AMO.STATUS];
  pipeline?: number;
  loss_reason?: number;
  custom_fields: [number, string][];
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
          [
            AMO.CUSTOM_FIELD.CDEK_INVOICE_URL,
            `https://lk.cdek.ru/print/print-order?numberOrd=${data.attributes.cdek_number}`,
          ],
        );
        parsed.note = `✎ СДЭК${prefix}: получен трек-код ${data.attributes.cdek_number}, накладная https://lk.cdek.ru/print/print-order?numberOrd=${data.attributes.cdek_number} (1)`;
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
          break;
        }
        if (!data.attributes.status_reason_code) {
          parsed.note = `✔ СДЭК${prefix}: посылка успешно вручена адресату (4)`;
          parsed.status = AMO.STATUS.SUCCESS;
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
        break;
      case "19":
        parsed.status = data.attributes.is_return ? AMO.STATUS.RETURN : AMO.STATUS.SENT;
        break;
    }

    return parsed;
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

    let return_total = 0;
    const return_goods: Partial<EntityLink>[] = [];

    // count return goods
    for (const item of order.entity?.packages?.[0]?.items) {
      const diff_amount = Math.abs(item.amount - (item.delivery_amount ?? item.amount));
      if (diff_amount === 0) continue; // all items sold

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

    // delete return goods from direct, add it to return lead
    await Promise.all([
      this.amo.link.deleteLinksByEntityId(direct_lead.id, "leads", return_goods),
      this.amo.link.addLinksByEntityId(return_lead._embedded.leads[0].id, "leads", return_goods),
      this.amo.lead.updateLeadById(direct_lead.id, {
        status_id: AMO.STATUS.SUCCESS,
        price: direct_lead.price - return_total,
      }),
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
            text: `⇌ СДЕК ВОЗВРАТ: Частичный возврат по сделке ${direct_lead.id}`,
          },
        },
      ]),
    ]);

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
            text: `ℹ СДЕК ВОЗВРАТ\nВозвратный UUID: ${data.uuid}\nВозвратная накладная: https://lk.cdek.ru/print/print-order?numberOrd=${data.attributes.cdek_number}${reverse_price ? `\nСтоимость доставки: ${reverse_price}` : ""}`,
          },
        },
      ]),
    ]);

    return lead_by_direct_uuid;
  }
}
