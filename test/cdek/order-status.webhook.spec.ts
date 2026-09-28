import { Database } from "bun:sqlite";
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { type INestApplication } from "@nestjs/common";
import { LeadHelper } from "../../src/amo/helpers/lead.helper";
import { AMO } from "../../src/amo/amo.constants";
import { CdekPriceTable } from "../../src/db/cdek-price.table";
import { applyMigrations, DbService } from "../../src/db/db.service";
import { KpiTable } from "../../src/db/kpi.table";
import migration from "../../src/db/migration.sql" with { type: "text" };
import { type SalesLead, SalesTable } from "../../src/db/sales.table";
import { SpendingsTable } from "../../src/db/spendings.table";
import { GoogleSheetsService } from "../../src/google-sheets/google-sheets.service";
import { OrderStatusWebhook } from "../../src/cdek/webhooks/order-status.webhook";
import { createTestApp } from "../helpers/create-test-app";
import { createGoogleSheetsServiceMock } from "../mocks/google-sheets.mock";
import { order_status_factory } from "../mocks/cdek.mock";

type MockedFunction = { mock: { calls: unknown[][] } };

type OrderStatusInternals = {
  cdekPartialReturn(
    leadId: string,
    returnLeadId: string,
    goodSkuSuccess: string[],
    goodSkuReturn: string[],
    paymentType?: string,
  ): Promise<void>;
  cdekReturnCdekNumber(returnLeadId: string, returnCdekNumber: string): Promise<void>;
  cdekReturnRecieved(returnLeadId: string): Promise<void>;
};

function getCalls(fn: unknown): unknown[][] {
  return (fn as MockedFunction).mock.calls;
}

function leadFixture(): LeadHelper {
  return {
    goods: new Map([
      [1, { id: 1, quantity: 2, name: "Платье: M", sku: "DRESS-M", price: 2500 }],
      [2, { id: 2, quantity: 1, name: "Платье: L", sku: "DRESS-L", price: 2500 }],
    ]),
    custom_fields: new Map([
      [AMO.CUSTOM_FIELD.DISCOUNT, "10%"],
      [AMO.CUSTOM_FIELD.DELIVERY_COST, "350"],
      [AMO.CUSTOM_FIELD.CITY, "Москва"],
      [AMO.CUSTOM_FIELD.PAY_TYPE, "CARD"],
    ]),
    tags: new Set<number>(),
    getAdsString: () => "utm_source=test",
  } as unknown as LeadHelper;
}

describe("CDEK OrderStatusWebhook", () => {
  let app: INestApplication;
  let service: OrderStatusWebhook;
  let database: Database;
  let db: DbService;
  let googleSheets: ReturnType<typeof createGoogleSheetsServiceMock>;

  beforeAll(async () => {
    database = new Database(":memory:");
    applyMigrations(database, migration);
    db = {
      sales: new SalesTable(database),
      spendings: new SpendingsTable(database),
      kpi: new KpiTable(database),
      cdekPrice: new CdekPriceTable(database),
    } as unknown as DbService;
    googleSheets = createGoogleSheetsServiceMock();

    const { app: testApp, moduleRef } = await createTestApp({
      db,
      googleSheets: googleSheets as unknown as GoogleSheetsService,
    });

    app = testApp;
    service = moduleRef.get<OrderStatusWebhook>(OrderStatusWebhook);
  });

  beforeEach(() => {
    database.exec("DELETE FROM sales; DELETE FROM spendings; DELETE FROM kpi;");
    for (const fn of [
      googleSheets.sales.addLead,
      googleSheets.sales.cdekFullSuccess,
      googleSheets.sales.cdekFullReturn,
      googleSheets.sales.cdekPartialReturn,
      googleSheets.sales.cdekReturnCdekNumber,
      googleSheets.sales.cdekReturnRecieved,
    ]) {
      getCalls(fn).length = 0;
    }
  });

  afterAll(async () => {
    await app.close();
    database.close();
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
    expect(database.query("SELECT COUNT(*) AS count FROM sales").get()).toEqual({ count: 0 });
    expect(getCalls(googleSheets.sales.addLead)).toHaveLength(0);
  });

  test("3 writes the same goods to DB and Google Sheets", async () => {
    const createFromId = spyOn(LeadHelper, "createFromId").mockResolvedValue(leadFixture());

    try {
      expect(service.parse(order_status_factory(3, 20))).toStrictEqual({
        tag: [],
        custom_fields: [[1997433, `3/20, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
        note: "ℹ СДЭК: посылка принята на склад отправителя (3)",
        status: AMO.STATUS.SENT,
      });
      await Promise.resolve();

      expect(getCalls(googleSheets.sales.addLead)).toHaveLength(1);

      const googleEntry = getCalls(googleSheets.sales.addLead)[0][0] as SalesLead;
      const { shippingDate, ...googleData } = googleEntry;

      expect(typeof shippingDate).toBe("string");
      const expectedGoogleData: Record<string, unknown> = {
        status: "Отправлено",
        goods: [
          { id: 1, quantity: 2, name: "Платье: M", sku: "DRESS-M", price: 2500 },
          { id: 2, quantity: 1, name: "Платье: L", sku: "DRESS-L", price: 2500 },
        ],
        discount: "10%",
        customerDeliveryPrice: 350,
        deliveryType: "СДЭК Москва",
        paymentType: "CARD",
        leadId: "31045357",
        cdekNumber: "1197739374",
        ads: "utm_source=test",
        site: undefined,
      };
      expect(googleData as Record<string, unknown>).toEqual(expectedGoogleData);
      expect(
        database
          .query<
            {
              shipping_date: number;
              status: string;
              good_sku: string;
              good_name: string;
              good_size: string;
              price: number;
              discount: string;
              customer_delivery_price: number;
              delivery_type: string;
              payment_type: string;
              lead_id: string;
              cdek_number: string;
              ads: string;
              site: string;
            },
            []
          >(
            "SELECT shipping_date, status, good_sku, good_name, good_size, price, discount, customer_delivery_price, delivery_type, payment_type, lead_id, cdek_number, ads, site FROM sales ORDER BY id",
          )
          .all(),
      ).toEqual([
        {
          shipping_date: expect.any(Number),
          status: "Отправлено",
          good_sku: "DRESS-M",
          good_name: "Платье: M",
          good_size: "M",
          price: 2500,
          discount: "10%",
          customer_delivery_price: 350,
          delivery_type: "СДЭК Москва",
          payment_type: "CARD",
          lead_id: "31045357",
          cdek_number: "1197739374",
          ads: "utm_source=test",
          site: "",
        },
        {
          shipping_date: expect.any(Number),
          status: "Отправлено",
          good_sku: "DRESS-M",
          good_name: "Платье: M",
          good_size: "M",
          price: 2500,
          discount: "10%",
          customer_delivery_price: 350,
          delivery_type: "СДЭК Москва",
          payment_type: "CARD",
          lead_id: "31045357",
          cdek_number: "1197739374",
          ads: "utm_source=test",
          site: "",
        },
        {
          shipping_date: expect.any(Number),
          status: "Отправлено",
          good_sku: "DRESS-L",
          good_name: "Платье: L",
          good_size: "L",
          price: 2500,
          discount: "10%",
          customer_delivery_price: 350,
          delivery_type: "СДЭК Москва",
          payment_type: "CARD",
          lead_id: "31045357",
          cdek_number: "1197739374",
          ads: "utm_source=test",
          site: "",
        },
      ]);
    } finally {
      createFromId.mockRestore();
    }
  });

  test("4 updates DB before Google Sheets", () => {
    db.sales.addLead({ leadId: "31045357", goods: [{ name: "Платье", price: 2500 }] });

    expect(service.parse(order_status_factory(4))).toStrictEqual({
      tag: [],
      custom_fields: [[1997433, `4, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
      note: "✔ СДЭК: посылка успешно вручена адресату (4)",
      status: AMO.STATUS.SUCCESS,
    });

    expect(database.query("SELECT status FROM sales").get()).toEqual({ status: "Доставлено" });
    expect(getCalls(googleSheets.sales.cdekFullSuccess)).toEqual([["31045357"]]);
  });

  test("5 updates DB before Google Sheets", () => {
    db.sales.addLead({ leadId: "31045357", goods: [{ name: "Платье", price: 2500 }] });

    expect(service.parse(order_status_factory(5, 15))).toStrictEqual({
      tag: [AMO.TAG.RETURN],
      custom_fields: [[1997433, `5/15, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
      note: "ℹ СДЭК: посылка не вручена адресату (5) по причине отказа из-за того, что не устроили сроки (15)\n⇌ СДЕК ВОЗВРАТ: Сделка переведена в возвраты",
      pipeline: AMO.PIPELINE.RETURN,
      status: AMO.STATUS.RETURN,
    });

    expect(database.query("SELECT status, return_lead_id FROM sales").get()).toEqual({
      status: "Ждем возврат",
      return_lead_id: "31045357",
    });
    expect(getCalls(googleSheets.sales.cdekFullReturn)).toEqual([["31045357"]]);
  });

  test("5/20 keeps the same full-return behavior", () => {
    db.sales.addLead({ leadId: "31045357", goods: [{ name: "Платье", price: 2500 }] });

    expect(service.parse(order_status_factory(5, 20))).toStrictEqual({
      tag: [AMO.TAG.RETURN],
      custom_fields: [[1997433, `5/20, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`]],
      note: "ℹ СДЭК: посылка не вручена адресату (5) по причине частичной доставки (20)\n⇌ СДЕК ВОЗВРАТ: Сделка переведена в возвраты",
      pipeline: AMO.PIPELINE.RETURN,
      status: AMO.STATUS.RETURN,
    });
    expect(database.query("SELECT status FROM sales").get()).toEqual({ status: "Ждем возврат" });
  });

  test("4/20 invokes partial return processing", () => {
    const handlePartialReturn = spyOn(service, "handlePartialReturn").mockResolvedValue();

    expect(service.parse(order_status_factory(4, 20))).toStrictEqual({
      tag: [AMO.TAG.PARTIAL_RETURN],
      custom_fields: [
        [
          1997433,
          `4/20, Набережные Челны, ${new Date().toLocaleString("ru-RU")}`,
        ],
      ],
      note: "✔ СДЭК: частичный выкуп товаров адресатом (4/20)",
    });
    expect(handlePartialReturn).toHaveBeenCalledTimes(1);
    handlePartialReturn.mockRestore();
  });

  test("partial return writes the same updates to DB and Google Sheets", async () => {
    const internals = service as unknown as OrderStatusInternals;
    db.sales.addLead({
      leadId: "100",
      goods: [
        { name: "One", sku: "ONE", price: 100 },
        { name: "Two", sku: "TWO", price: 200 },
      ],
    });

    await internals.cdekPartialReturn("100", "200", ["ONE"], ["TWO"], "CARD");

    const expected = [["100", "200", ["ONE"], ["TWO"], "CARD"]];
    expect(getCalls(googleSheets.sales.cdekPartialReturn)).toEqual(expected);
    expect(
      database
        .query<
          { good_sku: string; status: string; return_lead_id: string; payment_type: string },
          []
        >(
          "SELECT good_sku, status, return_lead_id, payment_type FROM sales ORDER BY good_sku",
        )
        .all(),
    ).toEqual([
      { good_sku: "ONE", status: "Доставлено", return_lead_id: "", payment_type: "CARD" },
      { good_sku: "TWO", status: "Ждем возврат", return_lead_id: "200", payment_type: "" },
    ]);
  });

  test("return tracking and received updates match Google Sheets", async () => {
    const internals = service as unknown as OrderStatusInternals;
    db.sales.addLead({
      leadId: "100",
      returnLeadId: "100",
      goods: [{ name: "One", price: 100 }],
    });
    await internals.cdekReturnCdekNumber("100", "RETURN-CDEK");
    await internals.cdekReturnRecieved("100");

    expect(getCalls(googleSheets.sales.cdekReturnCdekNumber)).toEqual([["100", "RETURN-CDEK"]]);
    expect(getCalls(googleSheets.sales.cdekReturnRecieved)).toEqual([["100"]]);
    expect(database.query("SELECT return_cdek_number, status FROM sales").get()).toEqual({
      return_cdek_number: "RETURN-CDEK",
      status: "Возврат получен",
    });
  });
});
