import { Task } from "@shevernitskiy/amo";
import { UpdateOrderStatus } from "cdek/src/types/api/webhook";
import { Injectable } from "@nestjs/common";
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

const task_return: (number: string) => Partial<Task> = (number) => {
  return {
    entity_id: Number(number),
    entity_type: "leads",
    duration: 3600,
    task_type_id: AMO.TASK.PROCESS,
    responsible_user_id: AMO.USER.EKATERINA,
    created_by: AMO.USER.ADMIN,
    text: "Посылка вручена адресату частично, обработать частичный возврат",
  };
};

type ParsedWebhook = {
  note?: string;
  tag: number[];
  task?: Partial<Task>;
  status?: number;
  custom_fields: [number, string][];
};

@Injectable()
export class OrderStatusWebhook extends AbstractWebhook {
  async handle(data: UpdateOrderStatus) {
    if (
      !data.attributes.cdek_number ||
      !data.attributes.status_code ||
      !data.attributes.number ||
      Number(data.attributes.number) <= 99999
    ) {
      return;
    }

    const parsed = this.parse(data);

    const promises: Promise<unknown>[] = [
      this.amo.lead.updateLeadById(Number(data.attributes.number), {
        updated_at: Math.round(Date.now() / 1000),
        status_id: parsed.status,
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
}
