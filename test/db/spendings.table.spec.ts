import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applyMigrations } from "../../src/db/db.service";
import migration from "../../src/db/migration.sql" with { type: "text" };
import { SpendingsTable } from "../../src/db/spendings.table";

describe("SpendingsTable", () => {
  let database: Database;
  let spendings: SpendingsTable;

  beforeEach(() => {
    database = new Database(":memory:");
    applyMigrations(database, migration);
    spendings = new SpendingsTable(database);
  });

  afterEach(() => {
    database.close();
  });

  test("adds spending rows using named fields", async () => {
    const result = spendings.addSpendings([
      { date: 1_789_000_000, description: "Забор товара", amount: 1250.5 },
      { amount: 0 },
    ]);

    expect(result).toEqual({ addedRows: 2 });
    expect(
      database
        .query<{ date: number | null; description: string; amount: number | null }, []>(
          "SELECT date, description, amount FROM spendings ORDER BY id",
        )
        .all(),
    ).toEqual([
      { date: 1_789_000_000, description: "Забор товара", amount: 1250.5 },
      { date: null, description: "", amount: 0 },
    ]);
  });

  test("returns zero for an empty batch", async () => {
    expect(spendings.addSpendings([])).toEqual({ addedRows: 0 });
  });
});
