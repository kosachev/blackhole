import { mockAmoService } from "test/mocks/amo.mock";
import { order_status_factory } from "test/mocks/cdek.mock";
import { mockMailService } from "test/mocks/mail.mock";
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { OrderStatusWebhook } from "../../src/cdek/webhooks/order-status.webhook";

import { AMO } from "src/amo/amo.constants";

describe("CDEK OrderStatusWebhook", () => {
  let app: INestApplication;
  let service: OrderStatusWebhook;

  mockAmoService();
  mockMailService();

  beforeAll(async () => {
    const module_ref = await Test.createTestingModule({
      imports: [AppModule],
      providers: [OrderStatusWebhook],
    }).compile();

    app = module_ref.createNestApplication();
    service = module_ref.get<OrderStatusWebhook>(OrderStatusWebhook);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
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
