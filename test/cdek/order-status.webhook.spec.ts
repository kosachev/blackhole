import { describe, test, expect, beforeAll } from "vitest";

import { OrderStatusWebhook } from "src/cdek/webhooks/order-status.webhook";
import { CdekServiceMock, order_status_factory } from "test/mocks/cdek.mock";
import { AmoServiceMock } from "test/mocks/amo.mock";
import { TelegramServiceMock } from "test/mocks/telegram.mock";
import { AmoService } from "src/amo/amo.service";
import { CdekService } from "src/cdek/cdek.service";
import { TelegramService } from "src/telegram/telegram.service";
import { AMO } from "src/amo/amo.constants";

describe("CDEK OrderStatusWebhook", () => {
  let service: OrderStatusWebhook;

  beforeAll(async () => {
    service = new OrderStatusWebhook(
      new AmoServiceMock() as unknown as AmoService,
      new CdekServiceMock() as unknown as CdekService,
      new TelegramServiceMock() as unknown as TelegramService,
    );
  });

  test("1/20", () => {
    expect(service.parse(order_status_factory(1, 20))).toStrictEqual({
      custom_fields: [
        [1997433, `1/20, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`],
        [1430854, "1197739374"],
        [1997427, "https://lk.cdek.ru/print/print-order?numberOrd=1197739374"],
      ],
      note: `✎ СДЭК: получен трек-код 1197739374, накладная https://lk.cdek.ru/print/print-order?numberOrd=1197739374 (1)`,
      tag: [AMO.TAG.TRACK],
    });
  });

  test("3/22", () => {
    expect(service.parse(order_status_factory(3, 20))).toStrictEqual({
      tag: [],
      custom_fields: [[1997433, `3/20, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
      note: "ℹ СДЭК: посылка принята на склад отправителя (3)",
      status: AMO.STATUS.SENT,
    });
  });

  test("5/15", () => {
    expect(service.parse(order_status_factory(5, 15))).toStrictEqual({
      tag: [AMO.TAG.RETURN],
      custom_fields: [[1997433, `5/15, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
      note: "ℹ СДЭК: посылка не вручена адресату (5) по причине отказа из-за того, что не устроили сроки (15)",
      status: AMO.STATUS.RETURN,
    });
  });

  test("5/20", () => {
    expect(service.parse(order_status_factory(5, 20))).toStrictEqual({
      tag: [AMO.TAG.RETURN],
      custom_fields: [[1997433, `5/20, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
      note: "ℹ СДЭК: посылка не вручена адресату (5) по причине частичной доставки (20)",
      task: {
        entity_id: 31045357,
        entity_type: "leads",
        duration: 3600,
        task_type_id: AMO.TASK.PROCESS,
        responsible_user_id: AMO.USER.EKATERINA,
        created_by: AMO.USER.ADMIN,
        text: "Посылка вручена адресату частично, обработать частичный возврат",
      },
    });
  });

  test("4", () => {
    expect(service.parse(order_status_factory(4))).toStrictEqual({
      tag: [],
      custom_fields: [[1997433, `4, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
      note: "✔ СДЭК: посылка успешно вручена адресату (4)",
      status: AMO.STATUS.SUCCESS,
    });
  });

  test("4/20", () => {
    expect(service.parse(order_status_factory(4, 20))).toStrictEqual({
      tag: [AMO.TAG.RETURN],
      custom_fields: [[1997433, `4/20, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
      note: "✔ СДЭК: частичный выкуп товаров адресатом (4/20)",
      task: {
        entity_id: 31045357,
        entity_type: "leads",
        duration: 3600,
        task_type_id: AMO.TASK.PROCESS,
        responsible_user_id: AMO.USER.EKATERINA,
        created_by: AMO.USER.ADMIN,
        text: "Посылка вручена адресату частично, обработать частичный возврат",
      },
    });
  });
});
