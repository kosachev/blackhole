import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applyMigrations } from "../../src/db/db.service";
import migration from "../../src/db/migration.sql" with { type: "text" };
import { CdekPriceTable } from "../../src/db/cdek-price.table";

describe("CdekPriceTable", () => {
  let database: Database;
  let cdekPrice: CdekPriceTable;

  beforeEach(() => {
    database = new Database(":memory:");
    applyMigrations(database, migration);
    cdekPrice = new CdekPriceTable(database);
  });

  afterEach(() => {
    database.close();
  });

  test("returns undefined when delta is not configured", async () => {
    expect(cdekPrice.getCdekDelta()).toBeUndefined();
  });

  test("returns zero as a configured delta", async () => {
    database.run("INSERT INTO cdek_price (id, delta) VALUES (1, 0)");
    expect(cdekPrice.getCdekDelta()).toBe(0);
  });

  test("returns positive and negative deltas", async () => {
    database.run("INSERT INTO cdek_price (id, delta) VALUES (1, 125.5)");
    expect(cdekPrice.getCdekDelta()).toBe(125.5);

    database.run("UPDATE cdek_price SET delta = -50 WHERE id = 1");
    expect(cdekPrice.getCdekDelta()).toBe(-50);
  });
});
