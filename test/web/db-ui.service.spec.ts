import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { DbUiAuthService } from "../../src/web/db-ui-auth.service";
import { DbUiAuthGuard } from "../../src/web/db-ui-auth.guard";
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { Test } from "@nestjs/testing";
import { DbService, applyMigrations } from "../../src/db/db.service";
import { KpiTable } from "../../src/db/kpi.table";
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
