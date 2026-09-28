import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applyMigrations } from "../../src/db/db.service";
import migration from "../../src/db/migration.sql" with { type: "text" };
import { SalesTable } from "../../src/db/sales.table";

describe("SalesTable", () => {
  let database: Database;
  let sales: SalesTable;

  beforeEach(() => {
    database = new Database(":memory:");
    applyMigrations(database, migration);
    sales = new SalesTable(database);
  });

  afterEach(() => {
    database.close();
  });

  test("adds every goods quantity as a sales row", async () => {
    const result = sales.addLead({
      shippingDate: 1_789_000_000,
      status: "Отправлено",
      goods: [
        { name: "Платье: M", sku: "DRESS-M", price: 2500, quantity: 2 },
        { name: "Платье: L", sku: "DRESS-L", price: 2500 },
      ],
      discount: "10%",
      customerDeliveryPrice: 0,
      leadId: "100",
      cdekNumber: "CDEK-100",
      ads: "utm_source=test",
      site: "Gerda",
    });

    expect(result).toEqual({ addedEntries: 3 });
    expect(
      database
        .query<{ good_sku: string; good_size: string; shipping_date: number }, []>(
          "SELECT good_sku, good_size, shipping_date FROM sales ORDER BY id",
        )
        .all(),
    ).toEqual([
      { good_sku: "DRESS-M", good_size: "M", shipping_date: 1_789_000_000 },
      { good_sku: "DRESS-M", good_size: "M", shipping_date: 1_789_000_000 },
      { good_sku: "DRESS-L", good_size: "L", shipping_date: 1_789_000_000 },
    ]);
  });

  test("returns zero for empty goods", async () => {
    expect(sales.addLead({ leadId: "100", goods: [] })).toEqual({ addedEntries: 0 });
    expect(database.query("SELECT COUNT(*) AS count FROM sales").get()).toEqual({ count: 0 });
  });

  test("updates zero and empty values for matching identifiers", async () => {
    sales.addLead({
      leadId: "100",
      goods: [{ name: "One", price: 100 }],
      discount: "old",
    });
    sales.addLead({
      leadId: "200",
      cdekNumber: "CDEK-200",
      goods: [{ name: "Two", price: 200 }],
      discount: "old",
    });
    sales.addLead({
      leadId: "300",
      goods: [{ name: "Three", price: 300 }],
      discount: "old",
    });

    const result = sales.updateEntry(
      { leadId: ["100"], cdekNumber: ["CDEK-200"] },
      { price: 0, discount: "" },
    );

    expect(result).toEqual({ foundEntries: 2, updatedEntries: 2 });
    expect(
      database
        .query<{ lead_id: string; price: number; discount: string }, []>(
          "SELECT lead_id, price, discount FROM sales WHERE lead_id != '300' ORDER BY id",
        )
        .all(),
    ).toEqual([
      { lead_id: "100", price: 0, discount: "" },
      { lead_id: "200", price: 0, discount: "" },
    ]);
  });

  test("uses goodSku as a narrowing condition", async () => {
    sales.addLead({
      leadId: "100",
      goods: [
        { name: "One", sku: "ONE", price: 100 },
        { name: "Two", sku: "TWO", price: 200 },
      ],
    });

    expect(
      sales.updateEntry({ leadId: ["100"], goodSku: ["TWO"] }, { status: "Доставлено" }),
    ).toEqual({ foundEntries: 1, updatedEntries: 1 });
    expect(
      sales.updateEntry({ leadId: ["100"], goodSku: [] }, { status: "Возврат" }),
    ).toEqual({ foundEntries: 0, updatedEntries: 0 });
    expect(
      sales.updateEntry({ goodSku: ["ONE"] }, { status: "Возврат" }),
    ).toEqual({ foundEntries: 0, updatedEntries: 0 });
  });

  test("returns found entries without updates for an empty update", async () => {
    sales.addLead({ leadId: "100", goods: [{ name: "One", price: 100 }] });

    expect(sales.updateEntry({ leadId: ["100"] }, {})).toEqual({
      foundEntries: 1,
      updatedEntries: 0,
    });
  });

  test("applies CDEK success, return and tracking updates", async () => {
    sales.addLead({
      leadId: "100",
      goods: [{ name: "One", price: 100 }],
    });

    expect(sales.cdekFullSuccess("100", "Оплата картой")).toEqual({
      foundEntries: 1,
      updatedEntries: 1,
    });
    expect(sales.cdekFullReturn("100")).toEqual({ foundEntries: 1, updatedEntries: 1 });
    expect(sales.cdekReturnCdekNumber("100", "RETURN-CDEK")).toEqual({
      foundEntries: 1,
      updatedEntries: 1,
    });
    expect(sales.cdekReturnRecieved("100")).toEqual({
      foundEntries: 1,
      updatedEntries: 1,
    });

    expect(database.query("SELECT status, payment_type, return_cdek_number FROM sales").get()).toEqual({
      status: "Возврат получен",
      payment_type: "Оплата картой",
      return_cdek_number: "RETURN-CDEK",
    });
  });

  test("updates successful and returned goods independently", async () => {
    sales.addLead({
      leadId: "100",
      goods: [
        { name: "One", sku: "ONE", price: 100 },
        { name: "Two", sku: "TWO", price: 200 },
        { name: "Three", sku: "THREE", price: 300 },
      ],
    });

    expect(sales.cdekPartialReturn("100", "200", ["ONE", "TWO"], ["THREE"])).toEqual({
      foundEntries: 3,
      updatedEntries: 3,
    });
    expect(
      database
        .query<{ good_sku: string; status: string; return_lead_id: string }, []>(
          "SELECT good_sku, status, return_lead_id FROM sales ORDER BY id",
        )
        .all(),
    ).toEqual([
      { good_sku: "ONE", status: "Доставлено", return_lead_id: "" },
      { good_sku: "TWO", status: "Доставлено", return_lead_id: "" },
      { good_sku: "THREE", status: "Ждем возврат", return_lead_id: "200" },
    ]);
  });
});
