import { Database } from "bun:sqlite";
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { type INestApplication } from "@nestjs/common";
import { AMO } from "../../src/amo/amo.constants";
import { LeadHelper } from "../../src/amo/helpers/lead.helper";
import { LeadStatusWebhook } from "../../src/amo/webhooks/lead-status.webhook";
import { CdekPriceTable } from "../../src/db/cdek-price.table";
import { applyMigrations, DbService } from "../../src/db/db.service";
import { KpiTable } from "../../src/db/kpi.table";
import migration from "../../src/db/migration.sql" with { type: "text" };
import { type SalesLead, SalesTable } from "../../src/db/sales.table";
import { SpendingsTable } from "../../src/db/spendings.table";
import { GoogleSheetsService } from "../../src/google-sheets/google-sheets.service";
import { stringDate, stringDateTime } from "../../src/utils/timestamp.function";
import { createTestApp } from "../helpers/create-test-app";
import { createGoogleSheetsServiceMock } from "../mocks/google-sheets.mock";

type MockedFunction = { mock: { calls: unknown[][] } };

type LeadFixtureOptions = {
  statusId: number;
  leadId?: number;
  deliveryType?: string;
  responsibleUserId?: number;
  modifiedUserId?: number;
  tag?: number;
  email?: string;
};

type GoogleSalesEntry = Omit<SalesLead, "shippingDate"> & {
  shippingDate: string;
  color?: unknown;
};

type LeadStatusInternals = {
  logger: { error: (...args: unknown[]) => void };
  addLeadToGoogleSheets(lead: LeadHelper, status?: string, color?: unknown): Promise<void>;
  addKpiToGoogleSheets(lead: LeadHelper, kpiType: string): Promise<void>;
};

function getCalls(fn: unknown): unknown[][] {
  return (fn as MockedFunction).mock.calls;
}

function leadFixture(options: LeadFixtureOptions): LeadHelper {
  const customFields = new Map<number, string>([
    [AMO.CUSTOM_FIELD.ORDER_ID, "ORDER-1"],
    [AMO.CUSTOM_FIELD.DISCOUNT, "10%"],
    [AMO.CUSTOM_FIELD.DELIVERY_COST, "350"],
    [AMO.CUSTOM_FIELD.CITY, "Москва"],
    [AMO.CUSTOM_FIELD.PAY_TYPE, "CARD"],
  ]);
  if (options.deliveryType) {
    customFields.set(AMO.CUSTOM_FIELD.DELIVERY_TYPE, options.deliveryType);
    customFields.set(AMO.CUSTOM_FIELD.TRACK_NUMBER, "TRACK-1");
  }

  const contactFields = new Map<number, string>();
  if (options.email) {
    contactFields.set(AMO.CONTACT.EMAIL, options.email);
  }

  return {
    data: {
      id: options.leadId ?? 1001,
      status_id: options.statusId,
      pipeline_id: AMO.PIPELINE.MAIN,
      price: 5000,
      responsible_user_id: options.responsibleUserId ?? AMO.USER.MANAGER1,
      modified_user_id: options.modifiedUserId ?? AMO.USER.MANAGER2,
      created_at: 1_700_000_000,
    },
    custom_fields: customFields,
    tags: new Set(options.tag ? [options.tag] : []),
    goods: new Map([
      [1, { id: 1, quantity: 2, name: "Платье: M", sku: "DRESS-M", price: 2500 }],
      [2, { id: 2, quantity: 1, name: "Платье: L", sku: "DRESS-L", price: 2500 }],
    ]),
    contact: {
      id: 1,
      name: "Иван Иванов",
      first_name: "Иван",
      last_name: "Иванов",
      custom_fields: contactFields,
    },
    errors: [],
    warnings: [],
    note: () => undefined,
    saveToAmo: async () => undefined,
    getAdsString: () => "utm_source=test",
  } as unknown as LeadHelper;
}

function webhookData() {
  return { leads: { "0": [] } };
}

describe("AMO LeadStatusWebhook", () => {
  let app: INestApplication;
  let service: LeadStatusWebhook;
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
    service = moduleRef.get<LeadStatusWebhook>(LeadStatusWebhook);
  });

  beforeEach(() => {
    database.exec("DELETE FROM sales; DELETE FROM spendings; DELETE FROM kpi;");
    for (const fn of [
      googleSheets.sales.addLead,
      googleSheets.sales.cdekFullSuccess,
      googleSheets.kpi.addKpi,
    ]) {
      getCalls(fn).length = 0;
    }
  });

  afterAll(async () => {
    await app.close();
    database.close();
  });

  describe("DB", () => {
    test("adds the same sales data to DB and Google Sheets", async () => {
      const lead = leadFixture({
        statusId: AMO.STATUS.SENT,
        deliveryType: "Авито",
        tag: AMO.TAG.SITE,
      });
      const internals = service as unknown as LeadStatusInternals;

      await internals.addLeadToGoogleSheets(lead, "Отправлено");

      const googleEntry = getCalls(googleSheets.sales.addLead)[0][0] as GoogleSalesEntry;
      const { shippingDate, color, ...googleData } = googleEntry;

      expect(typeof shippingDate).toBe("string");
      expect(color).toBeUndefined();
      expect(googleData as Record<string, unknown>).toEqual({
        status: "Отправлено",
        goods: [
          { id: 1, quantity: 2, name: "Платье: M", sku: "DRESS-M", price: 2500 },
          { id: 2, quantity: 1, name: "Платье: L", sku: "DRESS-L", price: 2500 },
        ],
        discount: "10%",
        customerDeliveryPrice: 350,
        cdekNumber: "TRACK-1",
        deliveryType: "Авито",
        paymentType: "CARD",
        leadId: "1001",
        ads: "utm_source=test",
        site: "Gerda",
      });
      expect(
        database
          .query<
            {
              shipping_date: number;
              status: string;
              good_sku: string;
              good_size: string;
              lead_id: string;
              cdek_number: string;
              site: string;
            },
            []
          >(
            "SELECT shipping_date, status, good_sku, good_size, lead_id, cdek_number, site FROM sales ORDER BY id",
          )
          .all(),
      ).toEqual([
        {
          shipping_date: expect.any(Number),
          status: "Отправлено",
          good_sku: "DRESS-M",
          good_size: "M",
          lead_id: "1001",
          cdek_number: "TRACK-1",
          site: "Gerda",
        },
        {
          shipping_date: expect.any(Number),
          status: "Отправлено",
          good_sku: "DRESS-M",
          good_size: "M",
          lead_id: "1001",
          cdek_number: "TRACK-1",
          site: "Gerda",
        },
        {
          shipping_date: expect.any(Number),
          status: "Отправлено",
          good_sku: "DRESS-L",
          good_size: "L",
          lead_id: "1001",
          cdek_number: "TRACK-1",
          site: "Gerda",
        },
      ]);
      expect(stringDate()).toBe(shippingDate);
    });

    test("SENT Avito adds a sale before Google Sheets", async () => {
      const lead = leadFixture({ statusId: AMO.STATUS.SENT, deliveryType: "Авито" });
      const createFromWebhook = spyOn(LeadHelper, "createFromWebhook").mockResolvedValue(lead);

      try {
        await service.handle(webhookData());
      } finally {
        createFromWebhook.mockRestore();
      }

      expect(getCalls(googleSheets.sales.addLead)).toHaveLength(1);
      expect(database.query("SELECT status, lead_id FROM sales").all()).toHaveLength(3);
      expect(
        database
          .query<{ status: string; lead_id: string }, []>(
            "SELECT DISTINCT status, lead_id FROM sales",
          )
          .all(),
      ).toEqual([{ status: "Отправлено", lead_id: "1001" }]);
    });

    test("SENT Post adds a sale with the Tilda site", async () => {
      const lead = leadFixture({
        statusId: AMO.STATUS.SENT,
        deliveryType: "Почта России",
        tag: AMO.TAG.TILDA,
      });
      const createFromWebhook = spyOn(LeadHelper, "createFromWebhook").mockResolvedValue(lead);

      try {
        await service.handle(webhookData());
      } finally {
        createFromWebhook.mockRestore();
      }

      const googleEntry = getCalls(googleSheets.sales.addLead)[0][0] as GoogleSalesEntry;
      expect(googleEntry.status).toBe("Отправлено");
      expect(googleEntry.site).toBe("gerdacollection");
      expect(database.query("SELECT COUNT(*) AS count FROM sales").get()).toEqual({ count: 3 });
    });

    test("SENT CDEK does not add a sale", async () => {
      const lead = leadFixture({
        statusId: AMO.STATUS.SENT,
        deliveryType: "Экспресс по России",
      });
      const createFromWebhook = spyOn(LeadHelper, "createFromWebhook").mockResolvedValue(lead);

      try {
        await service.handle(webhookData());
      } finally {
        createFromWebhook.mockRestore();
      }

      expect(getCalls(googleSheets.sales.addLead)).toHaveLength(0);
      expect(database.query("SELECT COUNT(*) AS count FROM sales").get()).toEqual({ count: 0 });
    });

    test("SUCCESS Avito updates DB before Google Sheets", async () => {
      const lead = leadFixture({ statusId: AMO.STATUS.SUCCESS, deliveryType: "Авито" });
      const createFromWebhook = spyOn(LeadHelper, "createFromWebhook").mockResolvedValue(lead);
      db.sales.addLead({ leadId: "1001", goods: [{ name: "Платье", price: 2500 }] });

      try {
        await service.handle(webhookData());
      } finally {
        createFromWebhook.mockRestore();
      }

      expect(database.query("SELECT status, payment_type FROM sales").get()).toEqual({
        status: "Доставлено",
        payment_type: "CARD",
      });
      expect(getCalls(googleSheets.sales.cdekFullSuccess)).toEqual([["1001", "CARD"]]);
    });

    test("SUCCESS courier adds a sale without storing Google color", async () => {
      const lead = leadFixture({ statusId: AMO.STATUS.SUCCESS, deliveryType: "Самовывоз" });
      const createFromWebhook = spyOn(LeadHelper, "createFromWebhook").mockResolvedValue(lead);

      try {
        await service.handle(webhookData());
      } finally {
        createFromWebhook.mockRestore();
      }

      const googleEntry = getCalls(googleSheets.sales.addLead)[0][0] as GoogleSalesEntry & {
        color?: unknown;
      };
      expect(googleEntry.status).toBeUndefined();
      expect(googleEntry.color).toEqual({ red: 0.85, green: 0.96, blue: 0.85 });
      expect(database.query("SELECT status FROM sales").all()).toEqual([
        { status: "" },
        { status: "" },
        { status: "" },
      ]);
    });

    test("payment and delivery KPI types are written to both stores", async () => {
      const lead = leadFixture({ statusId: AMO.STATUS.PAYMENT });
      const internals = service as unknown as LeadStatusInternals;

      await internals.addKpiToGoogleSheets(lead, "payment");
      await internals.addKpiToGoogleSheets(lead, "delivery");

      expect(
        getCalls(googleSheets.kpi.addKpi).map(
          ([entry]) => (entry as Array<Record<string, unknown>>)[0].kpiType,
        ),
      ).toEqual([
        "payment",
        "delivery",
      ]);
      expect(database.query<{ kpi_type: string }, []>("SELECT kpi_type FROM kpi ORDER BY id").all()).toEqual([
        { kpi_type: "payment" },
        { kpi_type: "delivery" },
      ]);
    });

    test("VISIT writes matching KPI data to DB and Google Sheets", async () => {
      const lead = leadFixture({ statusId: AMO.STATUS.VISIT });
      const createFromWebhook = spyOn(LeadHelper, "createFromWebhook").mockResolvedValue(lead);

      try {
        await service.handle(webhookData());
      } finally {
        createFromWebhook.mockRestore();
      }

      const googleEntry = getCalls(googleSheets.kpi.addKpi)[0][0] as Array<Record<string, unknown>>;
      expect(googleEntry).toHaveLength(1);
      expect(googleEntry[0].kpiReachedAt).toBe(stringDateTime());
      expect(googleEntry[0].leadCreatedAt).toBe(
        stringDateTime(new Date(+lead.data.created_at! * 1000)),
      );
      expect(googleEntry[0]).toEqual({
        kpiReachedAt: stringDateTime(),
        leadCreatedAt: stringDateTime(new Date(+lead.data.created_at! * 1000)),
        leadId: "1001",
        responsibleUser: "Manager-1",
        statusUser: "Manager-2",
        kpiType: "visit",
        price: 5000,
      });

      expect(
        database
          .query<
            {
              kpi_reached_at: number;
              lead_created_at: number;
              lead_id: string;
              responsible_user: string;
              status_user: string;
              kpi_type: string;
              price: number;
            },
            []
          >(
            "SELECT kpi_reached_at, lead_created_at, lead_id, responsible_user, status_user, kpi_type, price FROM kpi",
          )
          .all(),
      ).toEqual([
        {
          kpi_reached_at: expect.any(Number),
          lead_created_at: 1_700_000_000,
          lead_id: "1001",
          responsible_user: "Manager-1",
          status_user: "Manager-2",
          kpi_type: "visit",
          price: 5000,
        },
      ]);
    });

    test("admin KPI is not written", async () => {
      const lead = leadFixture({
        statusId: AMO.STATUS.VISIT,
        responsibleUserId: AMO.USER.ADMIN,
      });
      const createFromWebhook = spyOn(LeadHelper, "createFromWebhook").mockResolvedValue(lead);

      try {
        await service.handle(webhookData());
      } finally {
        createFromWebhook.mockRestore();
      }

      expect(getCalls(googleSheets.kpi.addKpi)).toHaveLength(0);
      expect(database.query("SELECT COUNT(*) AS count FROM kpi").get()).toEqual({ count: 0 });
    });

    test("DB failure prevents Google Sheets write", async () => {
      const lead = leadFixture({ statusId: AMO.STATUS.SENT });
      const internals = service as unknown as LeadStatusInternals;
      const addLead = spyOn(db.sales, "addLead").mockImplementation(() => {
        throw new Error("DB failed");
      });
      const loggerError = spyOn(internals.logger, "error").mockImplementation(() => undefined);

      try {
        await internals.addLeadToGoogleSheets(lead, "Отправлено");
      } finally {
        addLead.mockRestore();
        loggerError.mockRestore();
      }

      expect(getCalls(googleSheets.sales.addLead)).toHaveLength(0);
    });

    test("Google failure does not roll back DB write", async () => {
      const lead = leadFixture({ statusId: AMO.STATUS.SENT });
      const internals = service as unknown as LeadStatusInternals;
      googleSheets.sales.addLead.mockImplementationOnce(async () => {
        throw new Error("Google failed");
      });
      const loggerError = spyOn(internals.logger, "error").mockImplementation(() => undefined);

      try {
        await internals.addLeadToGoogleSheets(lead, "Отправлено");
      } finally {
        loggerError.mockRestore();
      }

      expect(database.query("SELECT COUNT(*) AS count FROM sales").get()).toEqual({ count: 3 });
    });
  });
});
