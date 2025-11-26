import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SalesSheet } from "./sales.sheet";
import { SpendingsSheet } from "./spendings.sheet";

@Injectable()
export class GoogleSheetsService implements OnModuleInit {
  readonly logger = new Logger(GoogleSheetsService.name);

  private doc: GoogleSpreadsheet;
  sales: SalesSheet;
  spendings: SpendingsSheet;

  constructor(private readonly config: ConfigService) {
    this.doc = new GoogleSpreadsheet(
      this.config.get<string>("GOOGLE_SPREADSHEET_ID"),
      new JWT({
        email: this.config.get<string>("GOOGLE_SHEETS_EMAIL"),
        key: this.config.get<string>("GOOGLE_SHEETS_KEY"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      }),
    );
  }

  async onModuleInit() {
    await this.doc.loadInfo();
    this.sales = new SalesSheet(
      this.doc.sheetsByTitle[this.config.get<string>("GOOGLE_SALES_SHEET_NAME")],
    );
    await this.sales.onInit();

    this.spendings = new SpendingsSheet(
      this.doc.sheetsByTitle[this.config.get<string>("GOOGLE_SPENDINGS_SHEET_NAME")],
    );
  }
}
