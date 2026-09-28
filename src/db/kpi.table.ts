import type { Database } from "bun:sqlite";

export class KpiTable {
  constructor(private readonly database: Database) {}

  addKpi(kpi: KpiEntry[]): KpiAddResult {
    if (kpi.length === 0) {
      return { addedRows: 0 };
    }

    const insert = this.database.prepare(`
      INSERT INTO kpi (
        kpi_reached_at,
        lead_created_at,
        lead_id,
        responsible_user,
        status_user,
        kpi_type,
        price
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    return {
      addedRows: this.database
        .transaction(() => {
          for (const entry of kpi) {
            insert.run(
              entry.kpiReachedAt ?? null,
              entry.leadCreatedAt ?? null,
              entry.leadId ?? "",
              entry.responsibleUser ?? "",
              entry.statusUser ?? "",
              entry.kpiType ?? "",
              entry.price ?? null,
            );
          }

          return kpi.length;
        })
        .immediate(),
    };
  }
}

export type KpiEntry = Partial<{
  kpiReachedAt: number;
  leadCreatedAt: number;
  leadId: string;
  responsibleUser: string;
  statusUser: string;
  kpiType: string;
  price: number;
}>;

export type KpiAddResult = { addedRows: number };
