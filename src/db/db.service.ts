import { Database } from "bun:sqlite";
import { Glob } from "bun";
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import migration from "./migration.sql" with { type: "text" };
import { CdekPriceTable } from "./cdek-price.table";
import { KpiTable } from "./kpi.table";
import { SalesTable } from "./sales.table";
import { SpendingsTable } from "./spendings.table";

const BACKUP_DIR = "/backup";
const MAX_BACKUPS = 5;

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
  private databasePath!: string;
  sales!: SalesTable;
  spendings!: SpendingsTable;
  kpi!: KpiTable;
  cdekPrice!: CdekPriceTable;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.databasePath = resolve(process.cwd(), this.config.get<string>("DB_PATH") ?? "./data/gerda.db");
    await mkdir(dirname(this.databasePath), { recursive: true });

    this.database = new Database(this.databasePath);
    this.database.exec("PRAGMA journal_mode = DELETE; PRAGMA busy_timeout = 5000;");
    applyMigrations(this.database, migration);

    this.sales = new SalesTable(this.database);
    this.spendings = new SpendingsTable(this.database);
    this.kpi = new KpiTable(this.database);
    this.cdekPrice = new CdekPriceTable(this.database);
  }

  async backup(): Promise<string> {
    const path = `${BACKUP_DIR}/gerda-${new Date().toISOString().replaceAll(":", "-")}.db`;
    await Bun.write(path, Bun.file(this.databasePath));

    const backups = await Array.fromAsync(new Glob("gerda-*.db").scan({ cwd: BACKUP_DIR, absolute: true }));
    backups.sort().reverse();
    await Promise.all(backups.slice(MAX_BACKUPS).map((file) => Bun.file(file).delete()));

    return path;
  }

  onModuleDestroy(): void {
    this.database?.close();
  }
}
