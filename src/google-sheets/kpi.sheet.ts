import { type GoogleSpreadsheetWorksheet } from "google-spreadsheet";

export type KpiEntry = Partial<{
  kpiReachedAt: string;
  leadCreatedAt: string;
  leadId: string;
  responsibleUser: string;
  statusUser: string;
  kpiType: string;
  price: number;
}>;

export type KpiAddResult = { addedRows: number };

export class KpiSheet {
  private static readonly columns: Record<keyof KpiEntry, number> = {
    kpiReachedAt: 0,
    leadCreatedAt: 1,
    leadId: 2,
    responsibleUser: 3,
    statusUser: 4,
    kpiType: 5,
    price: 6,
  } as const;

  private readonly columnCount = Object.keys(KpiSheet.columns).length;

  constructor(private sheet: GoogleSpreadsheetWorksheet) {}

  async addKpi(kpi: KpiEntry[]): Promise<KpiAddResult> {
    const rows = await this.sheet.addRows(
      kpi.map((kpi) => Object.values(kpi)),
      { raw: true },
    );

    return { addedRows: rows.length };
  }
}
