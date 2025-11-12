import { JWT } from "google-auth-library";
import { GoogleSpreadsheet, type GoogleSpreadsheetWorksheet } from "google-spreadsheet";

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type Entry = Partial<{
  shippingDate: string;
  status: string;
  goodCategory: string;
  goodSku: string;
  goodName: string;
  goodSize: string;
  price: number;
  discount: string;
  customerDeliveryPrice: number;
  ownerDeliveryPrice: number;
  ownerReturnDeliveryPrice: number;
  deliveryType: string;
  paymentType: string;
  leadId: string;
  cdekNumber: string;
  returnLeadId: string;
  returnCdekNumber: string;
  closedByRegister: string;
  checkout: string;
}>;

export type UpdateResult = {
  foundEntries: number;
  updatedEntries: number;
};

export type AddResult = {
  addedEntries: number;
};

@Injectable()
export class GoogleSheetsService implements OnModuleInit {
  readonly logger = new Logger(GoogleSheetsService.name);

  private doc: GoogleSpreadsheet;
  private sheet!: GoogleSpreadsheetWorksheet;

  private startRowIndex = 1;
  private endRowIndex = 1000;

  private static readonly MAX_ROWS_TO_LOAD = 2000;

  static readonly colors = {
    lightGreen: { red: 0.85, green: 0.96, blue: 0.85 },
    ligthRed: { red: 0.96, green: 0.85, blue: 0.85 },
  } as const;

  private static readonly columns: Record<keyof Entry, number> = {
    shippingDate: 0,
    status: 1,
    goodCategory: 2,
    goodSku: 3,
    goodName: 4,
    goodSize: 5,
    price: 6,
    discount: 7,
    customerDeliveryPrice: 8,
    ownerDeliveryPrice: 9,
    ownerReturnDeliveryPrice: 10,
    deliveryType: 11,
    paymentType: 12,
    leadId: 13,
    cdekNumber: 14,
    returnLeadId: 15,
    returnCdekNumber: 16,
    closedByRegister: 17,
    checkout: 18,
  } as const;

  private readonly columnCount = Object.keys(GoogleSheetsService.columns).length;

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
    this.sheet = this.doc.sheetsByTitle[this.config.get<string>("GOOGLE_SHEET_NAME")];
    await this.fetchCdekSheetData();

    console.debug("Service loaded");
  }

  async fetchCdekSheetData(): Promise<void> {
    this.startRowIndex = Math.max(1, this.sheet.rowCount - GoogleSheetsService.MAX_ROWS_TO_LOAD);
    this.endRowIndex = this.sheet.rowCount;

    await this.sheet.loadCells({
      startRowIndex: this.startRowIndex,
      endRowIndex: this.endRowIndex,
      startColumnIndex: 0,
      endColumnIndex: this.columnCount,
    });

    console.debug(
      "CDEK sheet loaded, startRowIndex",
      this.startRowIndex,
      "endRowIndex",
      this.endRowIndex,
    );
  }

  async addLead(lead: {
    shippingDate?: string;
    status?: string;
    goods: {
      quantity?: number;
      name: string;
      sku?: string;
      price: number;
    }[];
    discount?: string;
    customerDeliveryPrice?: number;
    ownerDeliveryPrice?: number;
    ownerReturnDeliveryPrice?: number;
    deliveryType?: string;
    paymentType?: string;
    leadId: string;
    cdekNumber?: string;
    returnLeadId?: string;
    returnCdekNumber?: string;
    closedByRegister?: string;
    checkout?: string;
    color?: (typeof GoogleSheetsService.colors)[keyof typeof GoogleSheetsService.colors];
  }): Promise<AddResult> {
    const request = [];

    for (const good of lead.goods) {
      for (let i = 0; i < (good.quantity ?? 1); i++)
        request.push(
          [
            lead.shippingDate,
            lead.status,
            undefined,
            good.sku,
            good.name,
            undefined,
            good.price,
            lead.discount,
            lead.customerDeliveryPrice,
            lead.ownerDeliveryPrice,
            lead.ownerReturnDeliveryPrice,
            lead.deliveryType,
            lead.paymentType,
            lead.leadId,
            lead.cdekNumber,
            lead.returnLeadId,
            lead.returnCdekNumber,
            lead.closedByRegister,
            lead.checkout,
          ].map((value) => (value === undefined ? "" : value)),
        );
    }

    const rows = await this.sheet.addRows(request, { raw: true });
    await this.fetchCdekSheetData();

    for (
      let rowIndex = rows[0].rowNumber - 1;
      rowIndex < rows[rows.length - 1].rowNumber;
      rowIndex++
    ) {
      for (let colIndex = 0; colIndex < this.columnCount; colIndex++) {
        this.sheet.getCell(rowIndex, colIndex).clearAllFormatting();
        if (lead.color) {
          this.sheet.getCell(rowIndex, colIndex).backgroundColor = lead.color;
        }
      }
    }

    await this.sheet.saveUpdatedCells();
    return { addedEntries: rows.length };
  }

  async updateEntry(
    search: {
      leadId?: string;
      returnLeadId?: string;
      goodSku?: string[];
    },
    update: {
      shippingDate?: string;
      status?: string;
      goodCategory?: string;
      goodSku?: string;
      goodName?: string;
      goodSize?: string;
      price?: number;
      discount?: string;
      customerDeliveryPrice?: number;
      ownerDeliveryPrice?: number;
      ownerReturnDeliveryPrice?: number;
      deliveryType?: string;
      paymentType?: string;
      leadId?: string;
      cdekNumber?: string;
      returnLeadId?: string;
      returnCdekNumber?: string;
      closedByRegister?: string;
      checkout?: string;
      color?: (typeof GoogleSheetsService.colors)[keyof typeof GoogleSheetsService.colors];
    },
  ): Promise<UpdateResult> {
    let foundEntries = 0;
    let updatedEntries = 0;

    if (
      search.leadId === undefined &&
      search.returnLeadId === undefined &&
      search.goodSku === undefined
    ) {
      return { foundEntries: 0, updatedEntries: 0 };
    }

    for (let rowIndex = this.startRowIndex; rowIndex < this.endRowIndex; rowIndex++) {
      const leadIdCell = this.sheet.getCell(rowIndex, GoogleSheetsService.columns.leadId);
      const returnLeadIdCell = this.sheet.getCell(
        rowIndex,
        GoogleSheetsService.columns.returnLeadId,
      );

      if (
        (search.leadId && leadIdCell.value == search.leadId) ||
        (search.returnLeadId && returnLeadIdCell.value == search.returnLeadId)
      ) {
        if (search.goodSku !== undefined) {
          if (
            !search.goodSku.includes(
              this.sheet.getCell(rowIndex, GoogleSheetsService.columns.goodSku).value?.toString() ||
                "",
            )
          ) {
            continue;
          }
        }

        let updated = false;
        foundEntries++;

        if (update.shippingDate) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.shippingDate).value =
            update.shippingDate;
          updated = true;
        }

        if (update.status) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.status).value = update.status;
          updated = true;
        }

        if (update.goodCategory) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.goodCategory).value =
            update.goodCategory;
          updated = true;
        }

        if (update.goodSku) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.goodSku).value = update.goodSku;
          updated = true;
        }

        if (update.goodName) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.goodName).value =
            update.goodName;
          updated = true;
        }

        if (update.goodSize) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.goodSize).value =
            update.goodSize;
          updated = true;
        }

        if (update.price) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.price).value = update.price;
          updated = true;
        }

        if (update.discount) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.discount).value =
            update.discount;
          updated = true;
        }

        if (update.customerDeliveryPrice) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.customerDeliveryPrice).value =
            update.customerDeliveryPrice;
          updated = true;
        }

        if (update.ownerDeliveryPrice) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.ownerDeliveryPrice).value =
            update.ownerDeliveryPrice;
          updated = true;
        }

        if (update.ownerReturnDeliveryPrice) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.ownerReturnDeliveryPrice).value =
            update.ownerReturnDeliveryPrice;
          updated = true;
        }

        if (update.deliveryType) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.deliveryType).value =
            update.deliveryType;
          updated = true;
        }

        if (update.paymentType) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.paymentType).value =
            update.paymentType;
          updated = true;
        }

        if (update.leadId) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.leadId).value = update.leadId;
          updated = true;
        }

        if (update.cdekNumber) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.cdekNumber).value =
            update.cdekNumber;
          updated = true;
        }

        if (update.returnLeadId) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.returnLeadId).value =
            update.returnLeadId;
          updated = true;
        }

        if (update.returnCdekNumber) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.returnCdekNumber).value =
            update.returnCdekNumber;
          updated = true;
        }

        if (update.closedByRegister) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.closedByRegister).value =
            update.closedByRegister;
          updated = true;
        }

        if (update.checkout) {
          this.sheet.getCell(rowIndex, GoogleSheetsService.columns.checkout).value =
            update.checkout;
          updated = true;
        }

        if (update.color) {
          for (let colIndex = 0; colIndex < this.columnCount; colIndex++) {
            this.sheet.getCell(rowIndex, colIndex).backgroundColor = update.color;
          }
          updated = true;
        }

        if (updated) {
          updatedEntries++;
        }
      }
    }

    if (updatedEntries > 0) {
      await this.sheet.saveUpdatedCells();
      console.debug(`Updated ${updatedEntries} rows`);
    }

    return { foundEntries, updatedEntries };
  }

  cdekFullSuccess(leadId: string): Promise<UpdateResult> {
    return this.updateEntry(
      { leadId },
      {
        status: "Доставлено",
        color: GoogleSheetsService.colors.lightGreen,
      },
    );
  }

  cdekFullReturn(leadId: string): Promise<UpdateResult> {
    return this.updateEntry(
      { leadId },
      {
        status: "Ждем возврат",
        returnLeadId: leadId,
        color: GoogleSheetsService.colors.ligthRed,
      },
    );
  }

  async cdekPartialReturn(
    leadId: string,
    returnLeadId: string,
    goodSkuSuccess: string[],
    goodSkuReturn: string[],
  ): Promise<UpdateResult> {
    const [successResult, returnResult] = await Promise.all([
      this.updateEntry(
        { leadId, goodSku: goodSkuSuccess },
        { status: "Доставлено", color: GoogleSheetsService.colors.lightGreen },
      ),
      this.updateEntry(
        { leadId, goodSku: goodSkuReturn },
        { status: "Ждем возврат", returnLeadId, color: GoogleSheetsService.colors.ligthRed },
      ),
    ]);

    return {
      foundEntries: successResult.foundEntries + returnResult.foundEntries,
      updatedEntries: successResult.updatedEntries + returnResult.updatedEntries,
    };
  }

  cdekReturnCdekNumberAndDeliveryPrice(
    returnLeadId: string,
    returnCdekNumber: string,
    ownerReturnDeliveryPrice: number,
  ): Promise<UpdateResult> {
    return this.updateEntry({ returnLeadId }, { returnCdekNumber, ownerReturnDeliveryPrice });
  }

  cdekReturnRecieved(returnLeadId: string): Promise<UpdateResult> {
    return this.updateEntry({ returnLeadId }, { status: "Возврат получен" });
  }
}
