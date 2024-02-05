import { UpdateOrderStatus } from "cdek/src/types/api/webhook";
import { GetOrder } from "cdek/src/types/api/response";

import { Injectable } from "@nestjs/common";
import { Task } from "@shevernitskiy/amo";
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

const mock_cdek_return = {
  entity: {
    uuid: "72753031-86cc-497b-a1cf-a76f59065cb5",
    type: 2,
    is_return: true,
    is_reverse: false,
    cdek_number: "1510194305",
    tariff_code: 141,
    comment: "Ведомость на возврат RS/473/62819\nКоличество мест: 1",
    items_cost_currency: "RUB",
    recipient_currency: "RUB",
    keep_free_until: "2024-02-08T20:59:59Z",
    delivery_recipient_cost: {
      value: 0,
    },
    sender: {
      company: "СДЭК",
      name: "Акимцев Максим Олегович",
      phones: [{ number: "+79147562234" }, { number: "74242434444" }],
      passport_requirements_satisfied: false,
    },
    seller: {},
    recipient: {
      company: "КОСАЧЕВА ГАЛИНА АНАТОЛЬЕВНА",
      name: "Шутеева Галина Анатольевна",
      phones: [{ number: "74959955828" }],
      passport_requirements_satisfied: false,
    },
    from_location: {
      code: 473,
      city: "Южно-Сахалинск",
      fias_guid: "44388ad0-06aa-49b0-bbf9-1704629d1d68",
      kladr_code: "6500000100000",
      country_code: "RU",
      country: "Россия",
      region: "Сахалинская область",
      region_code: 20,
      sub_region: "городской округ Южно-Сахалинск",
      longitude: 0.0,
      latitude: 0.0,
      address: "ул.  Институтская, 15",
    },
    to_location: {
      code: 44,
      city: "Москва",
      fias_guid: "0c5b2444-70a0-4932-980c-b4dc0d3f02b5",
      kladr_code: "7700000000000",
      country_code: "RU",
      country: "Россия",
      region: "Москва",
      region_code: 81,
      sub_region: "Москва",
      longitude: 0.0,
      latitude: 0.0,
      address: "Лялин переулок д.7/2 стр.1",
    },
    services: [
      { code: "AGENT_COMMISSION", sum: 0.0 },
      { code: "CASH_ON_DELIVERY", sum: 0.0 },
    ],
    packages: [
      {
        number: "8845799522",
        weight: 4000,
        length: 20,
        width: 20,
        weight_volume: 1600,
        weight_calc: 4000,
        height: 20,
        comment: "Место №8845799522. Возвратная ведомость №RS/473/62819",
        items: [
          {
            name: 'Капор из песца  "Зима" белый',
            ware_key: "009000079000",
            payment: { value: 7500.0, vat_sum: 0.0 },
            weight: 500,
            weight_gross: 500,
            amount: 1,
            delivery_amount: 0,
            url: "gerda.msk.ru",
            return_item_detail: {
              direct_order_number: "4747",
              direct_order_uuid: "72753031-86cc-497b-a1cf-a76f59065cb5",
              direct_package_number: "37158075",
            },
            excise: false,
            cost: 7500.0,
          },
          {
            name: '105 см Парка с мехом чернобурки "Сюзанна" голубика рaзмер: L',
            ware_key: "00542398",
            payment: { value: 26900.0, vat_sum: 0.0 },
            weight: 2000,
            weight_gross: 2000,
            amount: 1,
            delivery_amount: 0,
            url: "gerda.msk.ru",
            return_item_detail: {
              direct_order_number: "4747",
              direct_order_uuid: "72753031-86cc-497b-a1cf-a76f59065cb5",
              direct_package_number: "37158075",
            },
            excise: false,
            cost: 26900.0,
          },
          {
            name: 'Капор с меховой опушкой "Ника" беж',
            ware_key: "009000615000",
            payment: { value: 5900.0, vat_sum: 0.0 },
            weight: 500,
            weight_gross: 500,
            amount: 1,
            delivery_amount: 0,
            url: "gerda.msk.ru",
            return_item_detail: {
              direct_order_number: "4747",
              direct_order_uuid: "72753031-86cc-497b-a1cf-a76f59065cb5",
              direct_package_number: "37158075",
            },
            excise: false,
            cost: 5900.0,
          },
        ],
        package_id: "8bbf35c0-7ea7-4e6f-a13c-d25c352ecd4b",
      },
    ],
    statuses: [
      { code: "DELIVERED", name: "Вручен", date_time: "2024-02-02T07:51:17+0000", city: "Москва" },
      {
        code: "TAKEN_BY_COURIER",
        name: "Выдан на доставку",
        date_time: "2024-02-02T07:24:47+0000",
        city: "Москва",
      },
      {
        code: "RETURNED_TO_RECIPIENT_CITY_WAREHOUSE",
        name: "Возвращен на склад доставки",
        date_time: "2024-02-02T07:24:47+0000",
        city: "Москва",
      },
      {
        code: "TAKEN_BY_COURIER",
        name: "Выдан на доставку",
        date_time: "2024-02-02T06:16:13+0000",
        city: "Москва",
      },
      {
        code: "RETURNED_TO_RECIPIENT_CITY_WAREHOUSE",
        name: "Возвращен на склад доставки",
        date_time: "2024-02-02T06:15:43+0000",
        city: "Москва",
      },
      {
        code: "TAKEN_BY_COURIER",
        name: "Выдан на доставку",
        date_time: "2024-02-02T05:12:42+0000",
        city: "Москва",
      },
      {
        code: "RETURNED_TO_RECIPIENT_CITY_WAREHOUSE",
        name: "Возвращен на склад доставки",
        date_time: "2024-02-02T05:11:41+0000",
        city: "Москва",
      },
      {
        code: "TAKEN_BY_COURIER",
        name: "Выдан на доставку",
        date_time: "2024-02-02T04:46:33+0000",
        city: "Москва",
      },
      {
        code: "ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE",
        name: "Принят на склад доставки",
        date_time: "2024-02-01T17:28:42+0000",
        city: "Москва",
      },
      {
        code: "ACCEPTED_IN_RECIPIENT_CITY",
        name: "Встречен в г. получателе",
        date_time: "2024-02-01T16:06:02+0000",
        city: "Москва",
      },
      {
        code: "SENT_TO_RECIPIENT_CITY",
        name: "Отправлен в г. получатель",
        date_time: "2024-02-01T14:15:57+0000",
        city: "Москва",
      },
      {
        code: "TAKEN_BY_TRANSPORTER_FROM_TRANSIT_CITY",
        name: "Сдан перевозчику в г. транзите",
        date_time: "2024-02-01T14:05:18+0000",
        city: "Москва",
      },
      {
        code: "READY_FOR_SHIPMENT_IN_TRANSIT_CITY",
        name: "Выдан на отправку в г. транзите",
        date_time: "2024-02-01T07:26:27+0000",
        city: "Москва",
      },
      {
        code: "ACCEPTED_AT_TRANSIT_WAREHOUSE",
        name: "Принят на склад транзита",
        date_time: "2024-02-01T06:48:21+0000",
        city: "Москва",
      },
      {
        code: "ACCEPTED_IN_TRANSIT_CITY",
        name: "Встречен в г. транзите",
        date_time: "2024-02-01T00:17:07+0000",
        city: "Москва",
      },
      {
        code: "SENT_TO_TRANSIT_CITY",
        name: "Отправлен в г. транзит",
        date_time: "2024-01-24T12:57:33+0000",
        city: "Хабаровск",
      },
      {
        code: "TAKEN_BY_TRANSPORTER_FROM_TRANSIT_CITY",
        name: "Сдан перевозчику в г. транзите",
        date_time: "2024-01-24T12:53:03+0000",
        city: "Хабаровск",
      },
      {
        code: "READY_FOR_SHIPMENT_IN_TRANSIT_CITY",
        name: "Выдан на отправку в г. транзите",
        date_time: "2024-01-24T07:05:55+0000",
        city: "Хабаровск",
      },
      {
        code: "ACCEPTED_AT_TRANSIT_WAREHOUSE",
        name: "Принят на склад транзита",
        date_time: "2024-01-24T07:05:50+0000",
        city: "Хабаровск",
      },
      {
        code: "SENT_TO_TRANSIT_CITY",
        name: "Отправлен в г. транзит",
        date_time: "2024-01-17T04:55:31+0000",
        city: "Южно-Сахалинск",
      },
      {
        code: "TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY",
        name: "Сдан перевозчику в г. отправителе",
        date_time: "2024-01-17T04:53:47+0000",
        city: "Южно-Сахалинск",
      },
      {
        code: "READY_FOR_SHIPMENT_IN_SENDER_CITY",
        name: "Выдан на отправку в г. отправителе",
        date_time: "2024-01-17T04:53:29+0000",
        city: "Южно-Сахалинск",
      },
      {
        code: "TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY",
        name: "Сдан перевозчику в г. отправителе",
        date_time: "2024-01-17T04:45:59+0000",
        city: "Южно-Сахалинск",
      },
      {
        code: "READY_FOR_SHIPMENT_IN_SENDER_CITY",
        name: "Выдан на отправку в г. отправителе",
        date_time: "2024-01-17T01:25:45+0000",
        city: "Южно-Сахалинск",
      },
      {
        code: "RECEIVED_AT_SHIPMENT_WAREHOUSE",
        name: "Принят на склад отправителя",
        date_time: "2024-01-15T07:37:09+0000",
        city: "Южно-Сахалинск",
      },
      { code: "CREATED", name: "Создан", date_time: "2024-01-15T07:37:08+0000", city: "Офис СДЭК" },
      {
        code: "ACCEPTED",
        name: "Принят",
        date_time: "2024-01-15T07:37:07+0000",
        city: "Офис СДЭК",
      },
    ],
    is_client_return: false,
    delivery_mode: "3",
    planned_delivery_date: "2024-02-22",
    delivery_date: "2024-02-02",
    delivery_detail: {
      date: "2024-02-02",
      recipient_name: "Шутеева Галина Анатольевна",
      delivery_sum: 1048.5,
      total_sum: 1048.5,
      payment_info: [],
      delivery_discount_percent: 0,
      delivery_discount_sum: 0.0,
    },
    calls: {},
  },
  requests: [],
  related_entities: [
    {
      uuid: "72753031-f5cc-4f36-9dc6-2b22253f9808",
      type: "direct_order",
      create_time: "2023-12-21T08:56:50+0000",
      cdek_number: "1502523004",
    },
  ],
};

const task_return: (number: string) => Partial<Task> = (number) => {
  return {
    entity_id: Number(number),
    entity_type: "leads",
    complete_till: ~~(Date.now() / 1000) + 3600,
    task_type_id: AMO.TASK.PROCESS,
    responsible_user_id: AMO.USER.EKATERINA,
    created_by: AMO.USER.ADMIN,
    text: "Посылка вручена адресату частично, обработать частичный возврат",
  };
};

type ParsedWebhook = {
  note?: string;
  tag: (typeof AMO.TAG)[keyof typeof AMO.TAG][];
  task?: Partial<Task>;
  status?: (typeof AMO.STATUS)[keyof typeof AMO.STATUS];
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

    console.log("before parese", data);
  }

  // async handle(data: UpdateOrderStatus) {
  //   if (
  //     !data?.attributes?.cdek_number ||
  //     !data?.attributes?.status_code ||
  //     !data?.attributes?.number ||
  //     Number(data.attributes.number) <= 99999
  //   ) {
  //     return;
  //   }

  //   const parsed = this.parse(data);

  //   const promises: Promise<unknown>[] = [
  //     this.amo.lead.updateLeadById(Number(data.attributes.number), {
  //       updated_at: Math.round(Date.now() / 1000),
  //       status_id: parsed.status,
  //       custom_fields_values: parsed.custom_fields.map((item) => {
  //         return {
  //           field_id: item[0], // or id?
  //           values: [{ value: item[1] }],
  //         };
  //       }),
  //       _embedded: {
  //         tags: parsed.tag.map((item) => {
  //           return { id: item };
  //         }),
  //       },
  //     }),
  //   ];

  //   if (parsed.note) {
  //     promises.push(
  //       this.amo.note.addNotes("leads", [
  //         {
  //           entity_id: Number(data.attributes.number),
  //           created_by: AMO.USER.ADMIN,
  //           note_type: "common",
  //           params: {
  //             text: parsed.note,
  //           },
  //         },
  //       ]),
  //     );
  //   }

  //   if (parsed.task) {
  //     promises.push(this.amo.task.addTasks([parsed.task]));
  //   }

  //   await Promise.all(promises);
  // }

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
        parsed.status = AMO.STATUS.SENT;
        break;
      case "4":
        if (!data.attributes.status_reason_code) {
          parsed.note = "✔ СДЭК: посылка успешно вручена адресату (4)";
          parsed.status = AMO.STATUS.SUCCESS;
          break;
        }
        if (data.attributes.status_reason_code !== "20") break;
        parsed.note = "✔ СДЭК: частичный выкуп товаров адресатом (4/20)";
        parsed.tag.push(AMO.TAG.RETURN);
        parsed.task = task_return(data.attributes.number);
        break;
      case "5":
        parsed.note = "ℹ СДЭК: посылка не вручена адресату (5)";
        parsed.tag.push(AMO.TAG.RETURN);
        if (!data.attributes.status_reason_code) break;
        parsed.note += status_reason_code[data.attributes.status_reason_code] ?? "";
        if (data.attributes.status_reason_code !== "20") {
          parsed.status = AMO.STATUS.RETURN;
        } else {
          parsed.task = task_return(data.attributes.number);
        }
        break;
      case "6":
        parsed.status = AMO.STATUS.SENT;
        break;
      case "7":
        parsed.status = AMO.STATUS.SENT;
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
        parsed.status = AMO.STATUS.SENT;
        break;
    }

    return parsed;
  }

  async handleReturn(data: UpdateOrderStatus): Promise<number> {
    console.log("handleReturn", data);

    const result = await this.amo.lead.getLeads({
      with: ["catalog_elements"],
      query: data.uuid,
    });
    let lead_id: number;
    if (!result) {
      console.log("return lead not exists, need to create");
      // create new lead for return
      // const cdek_return = await this.cdek.getOrderByUUID(data.uuid);
      const cdek_return: GetOrder = mock_cdek_return;
      console.log("cdek return data", cdek_return);
      const direct_lead_id =
        +cdek_return.entity.packages[0].items[0].return_item_detail.direct_package_number;
      const direct_lead = await this.amo.lead.getLeadById(direct_lead_id, {
        with: ["catalog_elements"],
      });

      console.log("direct_lead_id", direct_lead_id);
      console.log("direct_lead", direct_lead);
      console.log("direct_lead.catalog_elements", direct_lead._embedded.catalog_elements);
      //console.log(cdek_return.entity.packages[0].items[0].return_item_detail.direct_package_number);

      let return_total = 0;
      const return_goods = [];

      for (const item of cdek_return.entity.packages[0].items) {
        return_total += item.cost;
        return_goods.push({
          to_entity_id: +item.ware_key,
          to_entity_type: "catalog_elements",
          metadata: {
            catalog_id: AMO.CATALOG.GOODS,
            quantity: item.amount,
          },
        });
      }

      console.log("return_goods", return_goods);

      // const {
      //   _embedded: {
      //     leads: [{ id }],
      //   },
      // } = await this.amo.lead.addLeads([
      //   {
      //     name: `ТЕСТ Возврат по сделке ${direct_lead_id}`,
      //     status_id: AMO.STATUS.RETURN,
      //     price: return_total,
      //   },
      // ]);
      // await this.amo.link.addLinksByEntityId(id, "leads", return_goods);

      // lead_id = id;
      lead_id = 2;
    } else {
      lead_id = result._embedded.leads[0].id;
      console.log("return lead exists", lead_id);
    }

    return lead_id;
  }
}
