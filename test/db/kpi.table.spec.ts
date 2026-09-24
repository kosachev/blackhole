import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applyMigrations } from "../../src/db/db.service";
import migration from "../../src/db/migration.sql" with { type: "text" };
import { KpiTable } from "../../src/db/kpi.table";

describe("KpiTable", () => {
  let database: Database;
  let kpi: KpiTable;

  beforeEach(() => {
    database = new Database(":memory:");
    applyMigrations(database, migration);
    kpi = new KpiTable(database);
  });

  afterEach(() => {
    database.close();
  });

  test("adds KPI rows using named fields", async () => {
    const result = kpi.addKpi([
      {
        kpiReachedAt: 1_789_000_000,
        leadCreatedAt: 1_788_000_000,
        leadId: "100",
        responsibleUser: "Manager-1",
        statusUser: "Manager-2",
        kpiType: "payment",
        price: 2500,
      },
      { price: 0 },
    ]);

    expect(result).toEqual({ addedRows: 2 });
    expect(
      database
        .query<
          {
            kpi_reached_at: number | null;
            lead_id: string;
            responsible_user: string;
            kpi_type: string;
            price: number | null;
          },
          []
        >("SELECT kpi_reached_at, lead_id, responsible_user, kpi_type, price FROM kpi ORDER BY id")
        .all(),
    ).toEqual([
      {
        kpi_reached_at: 1_789_000_000,
        lead_id: "100",
        responsible_user: "Manager-1",
        kpi_type: "payment",
        price: 2500,
      },
      {
        kpi_reached_at: null,
        lead_id: "",
        responsible_user: "",
        kpi_type: "",
        price: 0,
      },
    ]);
  });

  test("returns zero for an empty batch", async () => {
    expect(kpi.addKpi([])).toEqual({ addedRows: 0 });
  });
});
