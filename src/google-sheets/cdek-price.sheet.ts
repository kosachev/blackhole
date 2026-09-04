import { type GoogleSpreadsheetWorksheet } from "google-spreadsheet";

export class CdekPriceSheet {
  private readonly deltaCell = "H10";

  constructor(private sheet: GoogleSpreadsheetWorksheet) {}

  async getCdekDelta(): Promise<number | undefined> {
    await this.sheet.loadCells(this.deltaCell);
    const val = this.sheet.getCellByA1(this.deltaCell).value;
    if (val && Number.isFinite(val)) return Number(val);
  }
}
