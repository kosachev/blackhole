import { mockAmoService } from "test/mocks/amo.mock";
import { order_status_factory } from "test/mocks/cdek.mock";
import { mockYandexDiskService } from "test/mocks/yadisk.mock";
import { mockGoogleSheetsService } from "test/mocks/google-sheets.mock";
import { mockMailService } from "test/mocks/mail.mock";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { OrderStatusWebhook } from "../../src/cdek/webhooks/order-status.webhook";

import { AMO } from "../../src/amo/amo.constants";

describe("CDEK OrderStatusWebhook", () => {
  let app: INestApplication;
  let service: OrderStatusWebhook;

  mockAmoService();
  mockMailService();
  mockGoogleSheetsService();
  mockYandexDiskService();

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
        [1997427, "https://lk.cdek.ru/order-history/1197739374/view"],
      ],
      note: `✎ СДЭК: получен трек-код 1197739374, накладная https://lk.cdek.ru/order-history/1197739374/view (1)`,
      tag: [],
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
      note: "ℹ СДЭК: посылка не вручена адресату (5) по причине отказа из-за того, что не устроили сроки (15)\n⇌ СДЕК ВОЗВРАТ: Сделка переведена в возвраты",
      pipeline: AMO.PIPELINE.RETURN,
      status: AMO.STATUS.RETURN,
      // status: AMO.STATUS.CLOSED,
      // loss_reason: AMO.LOSS_REASON.RETURN,
    });
  });

  test("5/20", () => {
    expect(service.parse(order_status_factory(5, 20))).toStrictEqual({
      tag: [AMO.TAG.RETURN],
      custom_fields: [[1997433, `5/20, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
      note: "ℹ СДЭК: посылка не вручена адресату (5) по причине частичной доставки (20)\n⇌ СДЕК ВОЗВРАТ: Сделка переведена в возвраты",
      pipeline: AMO.PIPELINE.RETURN,
      status: AMO.STATUS.RETURN,
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

  // test("4/20", () => {
  //   expect(service.parse(order_status_factory(4, 20))).toStrictEqual({
  //     tag: [AMO.TAG.PARTIAL_RETURN],
  //     custom_fields: [[
  //       1997433,
  //       `4/20, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`,
  //     ]],
  //     note: "✔ СДЭК: частичный выкуп товаров адресатом (4/20)",
  //   });
  // });
});
