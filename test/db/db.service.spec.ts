import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMigrations, DbService } from "../../src/db/db.service";
import migration from "../../src/db/migration.sql" with { type: "text" };

describe("DbService", () => {
  test("applies the complete migration file repeatedly", () => {
    const database = new Database(":memory:");

    applyMigrations(database, migration);
    applyMigrations(database, migration);

    expect(
      database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name != 'sqlite_sequence' ORDER BY name",
        )
        .all(),
    ).toEqual([
      { name: "cdek_price" },
      { name: "kpi" },
      { name: "sales" },
      { name: "spendings" },
    ]);

    database.close();
  });

  test("rolls back the complete migration file on failure", () => {
    const database = new Database(":memory:");
    const source = `
      CREATE TABLE IF NOT EXISTS first_table (id INTEGER PRIMARY KEY);
      INSERT INTO missing_table (id) VALUES (1);
    `;

    expect(() => applyMigrations(database, source)).toThrow();
    expect(database.query("SELECT name FROM sqlite_master WHERE name = 'first_table'").get()).toBeNull();

    database.close();
  });

  test("uses the delete journal and initializes facades", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gerda-db-"));
    const path = join(directory, "gerda.db");
    const config = {
      get: (key: string) => (key === "DB_PATH" ? path : undefined),
    } as ConfigService;
    const service = new DbService(config);

    await service.onModuleInit();
    expect(service.sales).toBeDefined();
    expect(service.spendings).toBeDefined();
    expect(service.kpi).toBeDefined();
    expect(service.cdekPrice).toBeDefined();
    service.onModuleDestroy();

    const database = new Database(path);
    expect(database.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()).toEqual({
      journal_mode: "delete",
    });
    database.close();
    await rm(directory, { recursive: true, force: true });
  });
});
