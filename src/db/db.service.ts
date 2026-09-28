import { Database } from "bun:sqlite";
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import migration from "./migration.sql" with { type: "text" };
import { CdekPriceTable } from "./cdek-price.table";
import { KpiTable } from "./kpi.table";
import { SalesTable } from "./sales.table";
import { SpendingsTable } from "./spendings.table";

export function applyMigrations(database: Database, source: string): void {
  database
    .transaction(() => {
      database.exec(source);
    })
    .immediate();
}

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private database!: Database;
  sales!: SalesTable;
  spendings!: SpendingsTable;
  kpi!: KpiTable;
  cdekPrice!: CdekPriceTable;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const path = resolve(process.cwd(), this.config.get<string>("DB_PATH") ?? "./data/gerda.db");
    await mkdir(dirname(path), { recursive: true });

    this.database = new Database(path);
    this.database.exec("PRAGMA journal_mode = DELETE; PRAGMA busy_timeout = 5000;");
    applyMigrations(this.database, migration);

    this.sales = new SalesTable(this.database);
    this.spendings = new SpendingsTable(this.database);
    this.kpi = new KpiTable(this.database);
    this.cdekPrice = new CdekPriceTable(this.database);
  }

  onModuleDestroy(): void {
    this.database?.close();
  }
}
