import { UpdateOrderStatus } from "cdek/src/types/api/webhook";

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { EntityLink, Task } from "@shevernitskiy/amo";
import { AbstractWebhook } from "./abstract.webhook";
import { AMO } from "../../amo/amo.constants";

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
      data.attributes.number = (await this.handleReturn(data)).toString();
    }
    if (!data?.attributes?.number || Number(data.attributes.number) <= 99999) return;

    const parsed = this.parse(data);

    const promises: Promise<unknown>[] = [
      this.amo.lead.updateLeadById(Number(data.attributes.number), {
        updated_at: Math.round(Date.now() / 1000),
        status_id: parsed.status,
        pipeline_id: parsed.pipeline,
        loss_reason_id: parsed.loss_reason,
        custom_fields_values: parsed.custom_fields.map((item) => {
          return {
            field_id: item[0],
            values: [{ value: item[1] }],
          };
        }),
        _embedded: {
          tags: parsed.tag.map((item) => {
            return { id: item };
          }),
        },
      }),
    ];

    if (parsed.note) {
      promises.push(
        this.amo.note.addNotes("leads", [
          {
            entity_id: Number(data.attributes.number),
            created_by: AMO.USER.ADMIN,
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

    switch (data.attributes.status_code) {
      case "1":
        parsed.custom_fields.push(
          [AMO.CUSTOM_FIELD.TRACK_NUMBER, data.attributes.cdek_number],
          [
            AMO.CUSTOM_FIELD.CDEK_INVOICE_URL,
            `https://lk.cdek.ru/print/print-order?numberOrd=${data.attributes.cdek_number}`,
          ],
        );
        parsed.note = `✎ СДЭК: получен трек-код ${data.attributes.cdek_number}, накладная https://lk.cdek.ru/print/print-order?numberOrd=${data.attributes.cdek_number} (1)`;
        parsed.tag.push(AMO.TAG.TRACK);
        break;
      case "3":
        parsed.note = "ℹ СДЭК: посылка принята на склад отправителя (3)";
        parsed.status = data.attributes.is_return ? AMO.STATUS.RETURN : AMO.STATUS.SENT;
        break;
      case "4":
        if (data.attributes.is_return) {
          parsed.task = {
            entity_id: +data.attributes.number,
            entity_type: "leads",
            complete_till: ~~(Date.now() / 1000) + 3600,
            task_type_id: AMO.TASK.PROCESS,
            responsible_user_id: AMO.USER.EKATERINA,
            created_by: AMO.USER.ADMIN,
            text: "Принять возврат",
          };
          parsed.note = "✔ СДЭК: возврат получен (4)";
          parsed.status = AMO.STATUS.CLOSED;
          parsed.loss_reason = AMO.LOSS_REASON.CDEK_PARTIAL_RETURN;
          parsed.pipeline = AMO.PIPELINE.RETURN;
          break;
        }
        if (!data.attributes.status_reason_code) {
          parsed.note = "✔ СДЭК: посылка успешно вручена адресату (4)";
          parsed.status = AMO.STATUS.SUCCESS;
          break;
        }
        if (data.attributes.status_reason_code !== "20") break;
        parsed.note = "✔ СДЭК: частичный выкуп товаров адресатом (4/20)";
        parsed.tag.push(AMO.TAG.RETURN);
        break;
      case "5":
        parsed.note = "ℹ СДЭК: посылка не вручена адресату (5)";
        parsed.tag.push(AMO.TAG.RETURN);
        if (!data.attributes.status_reason_code) break;
        parsed.note += status_reason_code[data.attributes.status_reason_code] ?? "";
        // parsed.status = AMO.STATUS.CLOSED;
        // parsed.loss_reason = AMO.LOSS_REASON.RETURN;
        break;
      case "6":
        parsed.status = data.attributes.is_return ? AMO.STATUS.RETURN : AMO.STATUS.SENT;
        break;
      case "7":
        parsed.status = data.attributes.is_return ? AMO.STATUS.RETURN : AMO.STATUS.SENT;
        break;
      case "10":
        parsed.note = `ℹ СДЭК: посылка прибыла на склад города-получателя ${data.attributes.city_name ?? ""}, ожидает доставки до двери (10)`;
        break;
      case "11":
        parsed.note = "ℹ СДЭК: посылка выдана на доставку (11)";
        break;
      case "12":
        parsed.note = `ℹ СДЭК: посылка прибыла на склад до востребования города-получателя ${data.attributes.city_name ?? ""}, ожидает забора клиентом (12)`;
        break;
      case "19":
        parsed.status = data.attributes.is_return ? AMO.STATUS.RETURN : AMO.STATUS.SENT;
        break;
    }

    return parsed;
  }

  async handleReturn(data: UpdateOrderStatus): Promise<number> {
    const result = await this.amo.lead.getLeads({
      with: ["catalog_elements"],
      query: data.uuid,
    });

    if (result) return result._embedded.leads[0].id;

    const cdek_return = await this.cdek.getOrderByUUID(data.uuid);
    const direct_lead_id = +cdek_return.entity.packages.at(0)?.items.at(0)?.return_item_detail
      ?.direct_package_number;
    if (!direct_lead_id) {
      throw new InternalServerErrorException(
        "Unable to fetch direct lead id from return cdek order",
      );
    }
    const direct_lead = await this.amo.lead.getLeadById(direct_lead_id, {
      with: ["catalog_elements", "contacts"],
    });
    if (!direct_lead) {
      throw new InternalServerErrorException("Unable to fetch direct lead from amo");
    }

    let return_total = 0;
    const return_goods: Partial<EntityLink>[] = [];
    for (const item of cdek_return.entity.packages[0].items) {
      return_total += item.cost;
      const [catalog_id, catalog_element_id] = item.ware_key.split("-");
      return_goods.push({
        to_entity_id: +catalog_element_id,
        to_entity_type: "catalog_elements",
        metadata: {
          catalog_id: +catalog_id,
          quantity: item.amount,
        },
      });
    }

    // Возможно нужно исправлять больше полей кастом филд при копировании, тогда подредактировать свич
    const return_lead = await this.amo.lead.addLeads([
      {
        status_id: AMO.STATUS.RETURN,
        pipeline_id: AMO.PIPELINE.RETURN,
        name: `Возврат по сделке ${direct_lead.id}`,
        price: return_total,
        custom_fields_values: direct_lead.custom_fields_values.map((item) => {
          switch (item.field_id) {
            case AMO.CUSTOM_FIELD.TRACK_NUMBER:
              item.values[0].value = data.attributes.cdek_number;
              break;
            case AMO.CUSTOM_FIELD.CDEK_UUID:
              item.values[0].value = data.uuid;
          }
          return item;
        }),
        _embedded: {
          contacts: [{ id: direct_lead._embedded.contacts[0].id }],
          tags: [{ id: AMO.TAG.RETURN }],
        },
      },
    ]);

    if (!return_lead) throw new InternalServerErrorException("Unable to create return lead");

    const return_lead_id = return_lead._embedded.leads[0].id;
    const full_return = return_goods.length === direct_lead._embedded.catalog_elements.length;

    await Promise.all([
      this.amo.link.deleteLinksByEntityId(direct_lead_id, "leads", return_goods),
      this.amo.link.addLinksByEntityId(return_lead_id, "leads", return_goods),
      this.amo.lead.updateLeadById(direct_lead_id, {
        status_id: full_return ? AMO.STATUS.CLOSED : AMO.STATUS.SUCCESS,
        loss_reason_id: full_return ? AMO.LOSS_REASON.RETURN : undefined,
        price: direct_lead.price - return_total,
        _embedded: {
          tags: [{ id: AMO.TAG.RETURN }],
        },
      }),
      this.amo.note.addNotes("leads", [
        {
          entity_id: direct_lead_id,
          created_by: AMO.USER.ADMIN,
          note_type: "common",
          params: {
            text: `✔ Сделка переведена в ${full_return ? "не" : ""}реализованные, ${full_return ? "" : "частичный "}возврат по ссылке https://gerda.amocrm.ru/leads/detail/${return_lead_id}`,
          },
        },
        {
          entity_id: return_lead_id,
          created_by: AMO.USER.ADMIN,
          note_type: "common",
          params: {
            text: `⇌  ${full_return ? "Возврат" : "Частичный возврат"} по сделке ${direct_lead_id}, ссылка https://gerda.amocrm.ru/leads/detail/${direct_lead_id}, прямая накладная ${cdek_return.related_entities[0].cdek_number}`,
          },
        },
      ]),
    ]);

    return return_lead_id;
  }
}
