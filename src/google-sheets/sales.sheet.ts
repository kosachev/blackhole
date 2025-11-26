import { type GoogleSpreadsheetWorksheet } from "google-spreadsheet";

export type SalesEntry = Partial<{
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
  returnClosedByRegister: string;
  checkout: string;
  ads: string;
  site: string;
}>;

export type SalesUpdateResult = {
  foundEntries: number;
  updatedEntries: number;
};

export type AddResult = {
  addedEntries: number;
};

export type SalesEntryColor = (typeof SalesSheet.colors)[keyof typeof SalesSheet.colors];

export class SalesSheet {
  private startRowIndex = 1;
  private endRowIndex = 1000;

  private static readonly MAX_ROWS_TO_LOAD = 2000;

  static readonly colors = {
    lightGreen: { red: 0.85, green: 0.96, blue: 0.85 },
    ligthRed: { red: 0.96, green: 0.85, blue: 0.85 },
  } as const;

  private static readonly columns: Record<keyof SalesEntry, number> = {
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
    returnClosedByRegister: 18,
    checkout: 19,
    ads: 20,
    site: 21,
  } as const;

  private readonly columnCount = Object.keys(SalesSheet.columns).length;

  constructor(private sheet: GoogleSpreadsheetWorksheet) {}

  async onInit(): Promise<void> {
    this.startRowIndex = Math.max(1, this.sheet.rowCount - SalesSheet.MAX_ROWS_TO_LOAD);
    this.endRowIndex = this.sheet.rowCount;

    await this.sheet.loadCells({
      startRowIndex: this.startRowIndex,
      endRowIndex: this.endRowIndex,
      startColumnIndex: 0,
      endColumnIndex: this.columnCount,
    });
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
    returnClosedByRegister?: string;
    checkout?: string;
    ads?: string;
    site?: string;
    color?: SalesEntryColor;
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
            lead.returnClosedByRegister,
            lead.checkout,
            lead.ads,
            lead.site,
          ].map((value) => (value === undefined ? "" : value)),
        );
    }

    const rows = await this.sheet.addRows(request, { raw: true });
    await this.onInit();

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
      leadId?: string[];
      returnLeadId?: string[];
      cdekNumber?: string[];
      returnCdekNumber?: string[];
      goodSku?: string[]; // narrowing
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
      returnClosedByRegister?: string;
      checkout?: string;
      ads?: string;
      color?: SalesEntryColor;
    },
    save = true,
  ): Promise<SalesUpdateResult> {
    let foundEntries = 0;
    let updatedEntries = 0;

    if (
      search.leadId === undefined &&
      search.returnLeadId === undefined &&
      search.cdekNumber === undefined &&
      search.returnCdekNumber === undefined &&
      search.goodSku === undefined
    ) {
      return { foundEntries: 0, updatedEntries: 0 };
    }

    for (let rowIndex = this.startRowIndex; rowIndex < this.endRowIndex; rowIndex++) {
      const leadIdCell = this.sheet.getCell(rowIndex, SalesSheet.columns.leadId);
      const returnLeadIdCell = this.sheet.getCell(rowIndex, SalesSheet.columns.returnLeadId);
      const cdekNumberCell = this.sheet.getCell(rowIndex, SalesSheet.columns.cdekNumber);
      const returnCdekNumberCell = this.sheet.getCell(
        rowIndex,
        SalesSheet.columns.returnCdekNumber,
      );

      if (
        (search.leadId &&
          leadIdCell.value &&
          search.leadId.includes(leadIdCell.value.toString())) ||
        (search.returnLeadId &&
          returnLeadIdCell.value &&
          search.returnLeadId.includes(returnLeadIdCell.value.toString())) ||
        (search.cdekNumber &&
          cdekNumberCell.value &&
          search.cdekNumber.includes(cdekNumberCell.value.toString())) ||
        (search.returnCdekNumber &&
          returnCdekNumberCell.value &&
          search.returnCdekNumber.includes(returnCdekNumberCell.value.toString()))
      ) {
        if (search.goodSku !== undefined) {
          if (
            !search.goodSku.includes(
              this.sheet.getCell(rowIndex, SalesSheet.columns.goodSku).value?.toString() || "",
            )
          ) {
            continue;
          }
        }

        let updated = false;
        foundEntries++;

        if (update.shippingDate) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.shippingDate).value = update.shippingDate;
          updated = true;
        }

        if (update.status) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.status).value = update.status;
          updated = true;
        }

        if (update.goodCategory) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.goodCategory).value = update.goodCategory;
          updated = true;
        }

        if (update.goodSku) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.goodSku).value = update.goodSku;
          updated = true;
        }

        if (update.goodName) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.goodName).value = update.goodName;
          updated = true;
        }

        if (update.goodSize) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.goodSize).value = update.goodSize;
          updated = true;
        }

        if (update.price) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.price).value = update.price;
          updated = true;
        }

        if (update.discount) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.discount).value = update.discount;
          updated = true;
        }

        if (update.customerDeliveryPrice) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.customerDeliveryPrice).value =
            update.customerDeliveryPrice;
          updated = true;
        }

        if (update.ownerDeliveryPrice) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.ownerDeliveryPrice).value =
            update.ownerDeliveryPrice;
          updated = true;
        }

        if (update.ownerReturnDeliveryPrice) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.ownerReturnDeliveryPrice).value =
            update.ownerReturnDeliveryPrice;
          updated = true;
        }

        if (update.deliveryType) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.deliveryType).value = update.deliveryType;
          updated = true;
        }

        if (update.paymentType) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.paymentType).value = update.paymentType;
          updated = true;
        }

        if (update.leadId) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.leadId).value = update.leadId;
          updated = true;
        }

        if (update.cdekNumber) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.cdekNumber).value = update.cdekNumber;
          updated = true;
        }

        if (update.returnLeadId) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.returnLeadId).value = update.returnLeadId;
          updated = true;
        }

        if (update.returnCdekNumber) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.returnCdekNumber).value =
            update.returnCdekNumber;
          updated = true;
        }

        if (update.closedByRegister) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.closedByRegister).value =
            update.closedByRegister;
          updated = true;
        }

        if (update.returnClosedByRegister) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.returnClosedByRegister).value =
            update.returnClosedByRegister;
          updated = true;
        }

        if (update.checkout) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.checkout).value = update.checkout;
          updated = true;
        }

        if (update.ads) {
          this.sheet.getCell(rowIndex, SalesSheet.columns.ads).value = update.ads;
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

    if (updatedEntries > 0 && save) {
      await this.sheet.saveUpdatedCells();
    }

    return { foundEntries, updatedEntries };
  }

  async save(): Promise<void> {
    return this.sheet.saveUpdatedCells();
  }

  cdekFullSuccess(leadId: string, paymentType?: string): Promise<SalesUpdateResult> {
    return this.updateEntry(
      { leadId: [leadId] },
      {
        status: "Доставлено",
        paymentType,
        color: SalesSheet.colors.lightGreen,
      },
    );
  }

  cdekFullReturn(leadId: string): Promise<SalesUpdateResult> {
    return this.updateEntry(
      { leadId: [leadId] },
      {
        status: "Ждем возврат",
        returnLeadId: leadId,
        color: SalesSheet.colors.ligthRed,
      },
    );
  }

  async cdekPartialReturn(
    leadId: string,
    returnLeadId: string,
    goodSkuSuccess: string[],
    goodSkuReturn: string[],
    paymentType?: string,
  ): Promise<SalesUpdateResult> {
    const [successResult, returnResult] = await Promise.all([
      this.updateEntry(
        { leadId: [leadId], goodSku: goodSkuSuccess },
        { status: "Доставлено", paymentType, color: SalesSheet.colors.lightGreen },
      ),
      this.updateEntry(
        { leadId: [leadId], goodSku: goodSkuReturn },
        { status: "Ждем возврат", returnLeadId, color: SalesSheet.colors.ligthRed },
      ),
    ]);

    return {
      foundEntries: successResult.foundEntries + returnResult.foundEntries,
      updatedEntries: successResult.updatedEntries + returnResult.updatedEntries,
    };
  }

  cdekReturnCdekNumber(returnLeadId: string, returnCdekNumber: string): Promise<SalesUpdateResult> {
    return this.updateEntry({ returnLeadId: [returnLeadId] }, { returnCdekNumber });
  }

  cdekReturnRecieved(returnLeadId: string): Promise<SalesUpdateResult> {
    return this.updateEntry({ returnLeadId: [returnLeadId] }, { status: "Возврат получен" });
  }
}
