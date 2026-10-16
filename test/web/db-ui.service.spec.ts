import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { DbUiAuthService } from "../../src/web/db-ui-auth.service";
import { DbUiAuthGuard } from "../../src/web/db-ui-auth.guard";
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
    ],
  }).compile();
  try {
    expect(module.get(DbUiController).getKpi()).toEqual(kpi.getKpi());
    expect(module.get(DbUiController).getKpi()[0]).toMatchObject({ leadId: "42", price: 50000 });
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
      { provide: ConfigService, useValue: new ConfigService({}) },
      { provide: DbService, useValue: { kpi, sales, cdekPrice } },
    ],
  }).compile();
  try {
    const result = module.get(DbUiController).getCdekDelta();
    expect(result.storedDelta).toBe(12.5);
    expect(result.calculation.months).toHaveLength(2);

    const august = module.get(DbUiController).getCdekDelta("2026-08-01", "2026-08-31");
    expect(august.storedDelta).toBe(12.5);
    expect(august.calculation.total).toMatchObject({
      dealsCount: 1,
      delta: 100,
      averageDelta: 100,
    });
    expect(august.calculation.months.map((month) => month.key)).toEqual(["2026-08"]);

    const september = module.get(DbUiController).getCdekDelta("2026-09-01", "2026-09-30");
    expect(september.calculation.total.dealsCount).toBe(0);

    expect(() => module.get(DbUiController).getCdekDelta("2026-09-30", "2026-08-01")).toThrow();
    expect(() => module.get(DbUiController).getCdekDelta("2026-08-01", undefined)).toThrow();
  } finally {
    await module.close();
    database.close();
  }
});
