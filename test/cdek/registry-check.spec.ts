import { Database } from "bun:sqlite";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { type INestApplication } from "@nestjs/common";
import { CdekRegistryCheckService } from "../../src/cdek/cdek-registry-check.service";
import { CdekPriceTable } from "../../src/db/cdek-price.table";
import { applyMigrations, DbService } from "../../src/db/db.service";
import { KpiTable } from "../../src/db/kpi.table";
import migration from "../../src/db/migration.sql" with { type: "text" };
import { SalesTable } from "../../src/db/sales.table";
import { SpendingsTable } from "../../src/db/spendings.table";
import { GoogleSheetsService } from "../../src/google-sheets/google-sheets.service";
import { SalesSheet } from "../../src/google-sheets/sales.sheet";
import { createTestApp } from "../helpers/create-test-app";
import { createGoogleSheetsServiceMock } from "../mocks/google-sheets.mock";

type MockedFunction = { mock: { calls: unknown[][] } };

type OrdersMap = Parameters<CdekRegistryCheckService["proccessOrders"]>[0];

type OrderFixtureOptions = {
  cdekNumber: string;
  registryNumber?: number;
  leadId?: string;
  recipientName?: string;
  recipientCompany?: string;
  senderCompany?: string;
  items?: { sku: string; amount: number; deliveryAmount?: number }[];
  withoutCompany?: boolean;
};

type SalesRow = {
  id: number;
  good_sku: string;
  status: string;
  cdek_number: string;
  return_cdek_number: string;
  owner_delivery_price: number | null;
  owner_return_delivery_price: number | null;
  closed_by_register: string;
  return_closed_by_register: string;
  payment_type: string;
};

function getCalls(fn: unknown): unknown[][] {
  return (fn as MockedFunction).mock.calls;
}

// Mirrors GetCashOnDeliveryRegistry order merged with getOrderByCdekNumber entity,
// the exact shape proccessOrders() receives from batchGetOrder()
function orderFixture(options: OrderFixtureOptions): OrdersMap {
  const entity = {
    number: options.leadId,
    recipient: options.withoutCompany
      ? { name: options.recipientName ?? "Иван Иванов" }
      : { name: options.recipientName ?? "Иван Иванов", company: options.recipientCompany },
    sender: options.withoutCompany
      ? { name: "ИП Герда" }
      : { name: "ИП Герда", company: options.senderCompany ?? "Герда" },
    delivery_detail: { payment_info: [{ type: "CARD", sum: 5000 }] },
    packages: [
      {
        number: "1",
        weight: 1000,
        items: (options.items ?? [{ sku: "DRESS-M", amount: 1 }]).map((item) => ({
          name: item.sku,
          ware_key: item.sku,
          cost: 5000,
          payment: { value: 5000 },
          weight: 500,
          amount: item.amount,
          ...(item.deliveryAmount === undefined
            ? {}
            : { delivery_amount: item.deliveryAmount }),
        })),
      },
    ],
    statuses: [{ code: "DELIVERED", name: "Вручено", date_time: "2026-09-05T10:00:00+0300" }],
  };

  return new Map([
    [
      options.cdekNumber,
      {
        cdek_number: options.cdekNumber,
        registry_number: options.registryNumber ?? 42,
        transfer_sum: 5000,
        payment_sum: 5000,
        total_sum_without_agent: 5000,
        agent_commission_sum: 250,
        entity,
      },
    ],
  ]) as unknown as OrdersMap;
}

describe("CDEK CdekRegistryCheckService", () => {
  let app: INestApplication;
  let service: CdekRegistryCheckService;
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
    service = moduleRef.get<CdekRegistryCheckService>(CdekRegistryCheckService);
  });

  beforeEach(() => {
    database.exec("DELETE FROM sales; DELETE FROM spendings; DELETE FROM kpi;");
    getCalls(googleSheets.sales.updateEntry).length = 0;
    getCalls(googleSheets.sales.save).length = 0;
    getCalls(googleSheets.spendings.addSpendings).length = 0;
  });

  afterAll(async () => {
    await app.close();
    database.close();
  });

  function rows(): SalesRow[] {
    return database
      .query<
        SalesRow,
        []
      >(
        "SELECT id, good_sku, status, cdek_number, return_cdek_number, owner_delivery_price, owner_return_delivery_price, closed_by_register, return_closed_by_register, payment_type FROM sales ORDER BY id",
      )
      .all();
  }

  test("marks a fully delivered direct order as delivered", async () => {
    db.sales.addLead({
      leadId: "1001",
      cdekNumber: "111",
      status: "Отправлено",
      goods: [
        { name: "Платье: M", sku: "DRESS-M", price: 2500 },
        { name: "Платье: L", sku: "DRESS-L", price: 2500 },
      ],
    });

    const result = await service.proccessOrders(
      orderFixture({
        cdekNumber: "111",
        leadId: "1001",
        items: [
          { sku: "DRESS-M", amount: 1 },
          { sku: "DRESS-L", amount: 1 },
        ],
      }),
    );

    expect(result.directOrders).toBe(1);
    expect(rows().map((row) => row.status)).toEqual(["Доставлено", "Доставлено"]);
    expect(rows()[0]).toMatchObject({
      cdek_number: "111",
      owner_delivery_price: 5250,
      closed_by_register: "42",
      payment_type: "Оплата картой",
    });
    expect(getCalls(googleSheets.sales.updateEntry).at(-1)).toEqual([
      { cdekNumber: ["111"], goodSku: ["DRESS-M", "DRESS-L"] },
      { status: "Доставлено", color: SalesSheet.colors.lightGreen },
      false,
    ]);
  });

  test("marks only picked up goods as delivered on partial pickup", async () => {
    db.sales.addLead({
      leadId: "1002",
      cdekNumber: "222",
      status: "Отправлено",
      goods: [
        { name: "Платье: M", sku: "DRESS-M", price: 2500 },
        { name: "Платье: L", sku: "DRESS-L", price: 2500 },
      ],
    });

    await service.proccessOrders(
      orderFixture({
        cdekNumber: "222",
        leadId: "1002",
        items: [
          { sku: "DRESS-M", amount: 1 },
          { sku: "DRESS-L", amount: 2, deliveryAmount: 1 },
        ],
      }),
    );

    expect(rows().map((row) => [row.good_sku, row.status])).toEqual([
      ["DRESS-M", "Доставлено"],
      ["DRESS-L", "Отправлено"],
    ]);
  });

  test("marks a return order as received", async () => {
    db.sales.addLead({
      leadId: "1003",
      returnLeadId: "1003",
      cdekNumber: "333",
      returnCdekNumber: "444",
      status: "Ждем возврат",
      goods: [{ name: "Платье: M", sku: "DRESS-M", price: 2500 }],
    });

    const result = await service.proccessOrders(
      orderFixture({
        cdekNumber: "444",
        registryNumber: 77,
        senderCompany: "ООО СДЭК",
        items: [{ sku: "DRESS-M", amount: 1 }],
      }),
    );

    expect(result.returnOrders).toBe(1);
    expect(rows()[0]).toMatchObject({
      good_sku: "DRESS-M",
      return_cdek_number: "444",
      status: "Возврат получен",
      owner_return_delivery_price: 5000,
      return_closed_by_register: "77",
    });
  });

  test("keeps return rows untouched while return_cdek_number is unknown", async () => {
    db.sales.addLead({
      leadId: "1004",
      status: "Ждем возврат",
      goods: [{ name: "Платье: M", sku: "DRESS-M", price: 2500 }],
    });

    await service.proccessOrders(
      orderFixture({ cdekNumber: "555", senderCompany: "ООО СДЭК" }),
    );

    expect(rows().map((row) => row.status)).toEqual(["Ждем возврат"]);
  });

  test("records a courier pickup as spending and leaves sales alone", async () => {
    db.sales.addLead({
      leadId: "1005",
      cdekNumber: "666",
      status: "Отправлено",
      goods: [{ name: "Платье: M", sku: "DRESS-M", price: 2500 }],
    });

    const result = await service.proccessOrders(
      orderFixture({ cdekNumber: "666", recipientName: "СДЭК" }),
    );

    expect(result.courierPickups).toBe(1);
    expect(result.googleSheetsSpendingAddings).toBe(1);
    expect(rows().map((row) => row.status)).toEqual(["Отправлено"]);
    expect(getCalls(googleSheets.spendings.addSpendings)[0][0]).toEqual([
      {
        date: "05.09.2026",
        description: "Забор товара СДЭК 666 (реестр 42)",
        amount: 5000,
      },
    ]);
  });

  test("does not throw on orders without optional contacts", async () => {
    db.sales.addLead({
      leadId: "1006",
      cdekNumber: "777",
      status: "Отправлено",
      goods: [{ name: "Платье: M", sku: "DRESS-M", price: 2500 }],
    });

    const result = await service.proccessOrders(
      orderFixture({ cdekNumber: "777", withoutCompany: true }),
    );

    expect(result.directOrders).toBe(1);
    expect(rows().map((row) => row.status)).toEqual(["Доставлено"]);
  });
});
