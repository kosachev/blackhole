import type { Database } from "bun:sqlite";

export class KpiTable {
  constructor(private readonly database: Database) {}

  getKpi(): KpiRow[] {
    return this.database.query<KpiRow, []>(`
      SELECT id, kpi_reached_at AS kpiReachedAt, lead_created_at AS leadCreatedAt,
        lead_id AS leadId, responsible_user AS responsibleUser,
        status_user AS statusUser, kpi_type AS kpiType, price
      FROM kpi ORDER BY kpi_reached_at DESC, id DESC
    `).all();
  }

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

export type KpiRow = {
  id: number;
  kpiReachedAt: number | null;
  leadCreatedAt: number | null;
  leadId: string;
  responsibleUser: string;
  statusUser: string;
  kpiType: string;
  price: number | null;
};
