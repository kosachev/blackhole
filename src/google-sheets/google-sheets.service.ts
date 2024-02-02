import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GoogleSheetsService {
  private doc: GoogleSpreadsheet;

  constructor(private readonly config: ConfigService) {
    if (this.config.get<string>("NODE_ENV") === "testing") return;

    this.doc = new GoogleSpreadsheet(
      this.config.get<string>("GOOGLE_SPREADSHEET_ID"),
      new JWT({
        email: this.config.get<string>("GOOGLE_SHEETS_EMAIL"),
        key: this.config.get<string>("GOOGLE_SHEETS_KEY"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      }),
    );
    // hope service will not be called before loadInfo ends, or do it in every method

    this.doc.loadInfo();
  }

  async addSell(data: any): Promise<void> {
    console.log(data);
    //example
  }
}
