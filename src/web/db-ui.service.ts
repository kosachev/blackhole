import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service";
import { CdekDeltaService, type CdekDeltaResult } from "../cdek/cdek-delta.service";
import type { KpiRow } from "../db/kpi.table";

export type KpiReportRow = KpiRow & { latest: boolean; duplicate: boolean };

function newerKpi(row: KpiRow, other: KpiRow): boolean {
  const left = row.kpiReachedAt ?? -1;
  const right = other.kpiReachedAt ?? -1;
  return left > right || (left === right && row.id > other.id);
}

@Injectable()
export class DbUiService {
  constructor(private readonly db: DbService) {}

  getKpi(users?: string[]): KpiReportRow[] {
    const rows = this.db.kpi.getKpi();
    const latest = new Map<string, KpiRow>();
    const groups = new Map<string, number>();
    for (const row of rows) {
      groups.set(row.leadId, (groups.get(row.leadId) ?? 0) + 1);
      const current = latest.get(row.leadId);
      if (!current || newerKpi(row, current)) latest.set(row.leadId, row);
    }
    const flagged: KpiReportRow[] = rows.map((row) => ({
      ...row,
      latest: latest.get(row.leadId) === row,
      duplicate: (groups.get(row.leadId) ?? 0) > 1,
    }));
    return users ? flagged.filter((row) => users.includes(row.responsibleUser)) : flagged;
  }

  getCdekDelta(fromDate?: string, toDate?: string): {
    storedDelta: number | null;
    calculation: CdekDeltaResult;
  } {
    const { from, to } =
      fromDate === undefined && toDate === undefined
        ? CdekDeltaService.twoClosedMonthsRange()
        : CdekDeltaService.dayRange(fromDate ?? "", toDate ?? "");
    return {
      storedDelta: this.db.cdekPrice.getCdekDelta() ?? null,
      calculation: CdekDeltaService.calculate(
        this.db.sales.findByShippingDateRange(from, to),
        from,
        to,
      ),
    };
  }
}
