import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { DbUiAuthService } from "../../src/web/db-ui-auth.service";
import { DbUiAuthGuard, type DbUiRequest } from "../../src/web/db-ui-auth.guard";
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { Test } from "@nestjs/testing";
import { DbService, applyMigrations } from "../../src/db/db.service";
import { KpiTable } from "../../src/db/kpi.table";
import { SalesTable } from "../../src/db/sales.table";
import { CdekPriceTable } from "../../src/db/cdek-price.table";
import migration from "../../src/db/migration.sql" with { type: "text" };
import { DbUiService } from "../../src/web/db-ui.service";
import { DbUiController } from "../../src/web/db-ui.controller";
import { DeliveryPriceService } from "../../src/web/delivery-price.service";

const asRequest = (scope: { admin: boolean; users: string[] | null }) =>
  ({ dbUiScope: scope }) as unknown as DbUiRequest;
const adminRequest = asRequest({ admin: true, users: null });

test("web report delegates to the table getter and works with writes prohibited", async () => {
  const database = new Database(":memory:");
  applyMigrations(database, migration);
  const kpi = new KpiTable(database);
  kpi.addKpi([{ leadId: "42", responsibleUser: "Manager-2", kpiType: "visit", price: 50000 }]);
  database.exec("PRAGMA query_only = ON");
  const module = await Test.createTestingModule({
    controllers: [DbUiController],
    providers: [
      DbUiService, DbUiAuthService, DbUiAuthGuard,
      { provide: ConfigService, useValue: new ConfigService({}) },
      { provide: DbService, useValue: { kpi } },
      { provide: DeliveryPriceService, useValue: {} },
    ],
  }).compile();
  try {
    expect(module.get(DbUiController).getKpi(adminRequest)).toEqual([
      { ...kpi.getKpi()[0], latest: true, duplicate: false },
    ]);
    expect(module.get(DbUiController).getKpi(adminRequest)[0]).toMatchObject({ leadId: "42", price: 50000 });
  } finally {
    await module.close();
    database.close();
  }
});

test("marks the latest record of every deal and keeps duplicates visible for the owner", async () => {
  const database = new Database(":memory:");
  applyMigrations(database, migration);
  const kpi = new KpiTable(database);
  kpi.addKpi([
    { leadId: "42", responsibleUser: "Manager-1", kpiType: "visit", kpiReachedAt: 100, price: 1 },
    { leadId: "42", responsibleUser: "Manager-1", kpiType: "visit", kpiReachedAt: 200, price: 1 },
    { leadId: "42", responsibleUser: "Manager-2", kpiType: "visit", kpiReachedAt: 300, price: 1 },
    { leadId: "43", responsibleUser: "Manager-1", kpiType: "visit", kpiReachedAt: 400, price: 1 },
  ]);
  const module = await Test.createTestingModule({
    controllers: [DbUiController],
    providers: [
      DbUiService, DbUiAuthService, DbUiAuthGuard,
      { provide: ConfigService, useValue: new ConfigService({}) },
      { provide: DbService, useValue: { kpi } },
      { provide: DeliveryPriceService, useValue: {} },
    ],
  }).compile();
  try {
    const controller = module.get(DbUiController);
    const rows = controller.getKpi(adminRequest);
    expect(rows.map((row) => [row.id, row.latest, row.duplicate])).toEqual([
      [4, true, false],
      [3, true, true],
      [2, false, true],
      [1, false, true],
    ]);
    const guest = asRequest({ admin: false, users: ["Manager-1"] });
    expect(controller.getKpi(guest).map((row) => [row.id, row.latest])).toEqual([
      [4, true],
      [2, false],
      [1, false],
    ]);
  } finally {
    await module.close();
    database.close();
  }
});

test("cdek delta returns stored value and fresh two-month calculation", async () => {
  const database = new Database(":memory:");
  applyMigrations(database, migration);
  const kpi = new KpiTable(database);
  const sales = new SalesTable(database);
  const cdekPrice = new CdekPriceTable(database);
  sales.addLead({
    shippingDate: Date.UTC(2026, 7, 20) / 1000 - 3 * 3600,
    leadId: "1",
    deliveryType: "СДЭК до двери",
    closedByRegister: "реестр 7",
    customerDeliveryPrice: 500,
    ownerDeliveryPrice: 400,
    goods: [{ name: "Товар", price: 100 }],
  });
  cdekPrice.setCdekDelta(12.5);
  const module = await Test.createTestingModule({
    controllers: [DbUiController],
    providers: [
      DbUiService, DbUiAuthService, DbUiAuthGuard,
      { provide: ConfigService, useValue: { get: () => "400" } },
      { provide: DbService, useValue: { kpi, sales, cdekPrice } },
      { provide: DeliveryPriceService, useValue: { getCdekPriceAddition: () => 350 } },
    ],
  }).compile();
  try {
    const result = module.get(DbUiController).getCdekDelta(adminRequest);
    expect(result.storedDelta).toBe(12.5);
    expect(result.maxAddition).toBe(400);
    expect(result.finalAddition).toBe(350);
    expect(result.calculation.months).toHaveLength(2);

    const august = module.get(DbUiController).getCdekDelta(adminRequest, "2026-08-01", "2026-08-31");
    expect(august.storedDelta).toBe(12.5);
    expect(august.calculation.total).toMatchObject({
      dealsCount: 1,
      delta: 100,
      averageDelta: 100,
    });
    expect(august.calculation.months.map((month) => month.key)).toEqual(["2026-08"]);

    const september = module.get(DbUiController).getCdekDelta(adminRequest, "2026-09-01", "2026-09-30");
    expect(september.calculation.total.dealsCount).toBe(0);

    expect(() => module.get(DbUiController).getCdekDelta(adminRequest, "2026-09-30", "2026-08-01")).toThrow();
    expect(() => module.get(DbUiController).getCdekDelta(adminRequest, "2026-08-01", undefined)).toThrow();
  } finally {
    await module.close();
    database.close();
  }
});

test("guest scope limits KPI rows and closes other report endpoints", async () => {
  const database = new Database(":memory:");
  applyMigrations(database, migration);
  const kpi = new KpiTable(database);
  kpi.addKpi([
    { leadId: "1", responsibleUser: "Manager-2", kpiType: "visit", price: 100 },
    { leadId: "2", responsibleUser: "1110687", kpiType: "visit", price: 200 },
    { leadId: "3", responsibleUser: "Manager-1", kpiType: "visit", price: 300 },
  ]);
  const hash = await Bun.password.hash("test-only-password");
  const secret = "test-only-signing-secret-with-32-bytes";
  const module = await Test.createTestingModule({
    controllers: [DbUiController],
    providers: [
      DbUiService, DbUiAuthService, DbUiAuthGuard,
      {
        provide: ConfigService,
        useValue: new ConfigService({ DB_UI_PASSWORD_HASH: hash, DB_UI_TOKEN_SECRET: secret }),
      },
      { provide: DbService, useValue: { kpi } },
      { provide: DeliveryPriceService, useValue: { getCdekPriceAddition: () => 0 } },
    ],
  }).compile();
  try {
    const controller = module.get(DbUiController);
    const auth = module.get(DbUiAuthService);
    const token = auth.issueGuest("1110687", ["1110687", "Manager-2"], null);
    const scope = auth.verify(`Bearer ${token}`);
    expect(scope).toEqual({ admin: false, users: ["1110687", "Manager-2"] });

    const request = asRequest(scope);
    expect(controller.getKpi(request).map((row) => row.leadId)).toEqual(["2", "1"]);
    expect(() => controller.getCdekDelta(request)).toThrow();
    expect(() => controller.createGuest(request, { manager: "1110687", users: ["1110687"] })).toThrow();

    const { token: adminToken } = await auth.login("test-only-password", "test-ip");
    const adminScope = auth.verify(`Bearer ${adminToken}`);
    expect(adminScope).toEqual({ admin: true, users: null });
    expect(controller.getKpi(asRequest(adminScope))).toHaveLength(3);
    expect(controller.createGuest(asRequest(adminScope), { manager: "1110687", users: ["1110687"] }).token)
      .toStartWith("g1.");
  } finally {
    await module.close();
    database.close();
  }
});
