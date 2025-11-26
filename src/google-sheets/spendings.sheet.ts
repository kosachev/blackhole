import { type GoogleSpreadsheetWorksheet } from "google-spreadsheet";

export type SpendingsEntry = Partial<{
  date: string;
  description: string;
  amount: number;
}>;

export type SpendingsAddResult = { addedRows: number };

export class SpendingsSheet {
  private static readonly columns: Record<keyof SpendingsEntry, number> = {
    date: 0,
    description: 1,
    amount: 2,
  } as const;

  private readonly columnCount = Object.keys(SpendingsSheet.columns).length;

  constructor(private sheet: GoogleSpreadsheetWorksheet) {}

  async addSpendings(spendings: SpendingsEntry[]): Promise<SpendingsAddResult> {
    const rows = await this.sheet.addRows(
      spendings.map((spending) => Object.values(spending)),
      { raw: true },
    );

    return { addedRows: rows.length };
  }
}
