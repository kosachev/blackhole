import type { Database } from "bun:sqlite";

export class SalesTable {
  private static readonly updateColumns = {
    shippingDate: "shipping_date",
    status: "status",
    goodCategory: "good_category",
    goodSku: "good_sku",
    goodName: "good_name",
    goodSize: "good_size",
    price: "price",
    discount: "discount",
    customerDeliveryPrice: "customer_delivery_price",
    ownerDeliveryPrice: "owner_delivery_price",
    ownerReturnDeliveryPrice: "owner_return_delivery_price",
    deliveryType: "delivery_type",
    paymentType: "payment_type",
    leadId: "lead_id",
    cdekNumber: "cdek_number",
    returnLeadId: "return_lead_id",
    returnCdekNumber: "return_cdek_number",
    closedByRegister: "closed_by_register",
    returnClosedByRegister: "return_closed_by_register",
    checkout: "checkout",
    ads: "ads",
  } as const;

  constructor(private readonly database: Database) {}

  addLead(lead: SalesLead): AddResult {
    const rows: SalesRow[] = [];

    for (const good of lead.goods) {
      const quantity = good.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new Error(`Invalid goods quantity: ${quantity}`);
      }

      const sizePattern = good.name.match(/:\s*([A-Za-zА-Яа-я0-9/-]+)/imu);
      for (let i = 0; i < quantity; i++) {
        rows.push({
          shippingDate: lead.shippingDate ?? null,
          status: lead.status ?? "",
          goodCategory: "",
          goodSku: good.sku ?? "",
          goodName: good.name,
          goodSize: sizePattern?.at(1) ?? "",
          price: good.price,
          discount: lead.discount ?? "",
          customerDeliveryPrice: lead.customerDeliveryPrice ?? null,
          ownerDeliveryPrice: lead.ownerDeliveryPrice ?? null,
          ownerReturnDeliveryPrice: lead.ownerReturnDeliveryPrice ?? null,
          deliveryType: lead.deliveryType ?? "",
          paymentType: lead.paymentType ?? "",
          leadId: lead.leadId,
          cdekNumber: lead.cdekNumber ?? "",
          returnLeadId: lead.returnLeadId ?? "",
          returnCdekNumber: lead.returnCdekNumber ?? "",
          closedByRegister: lead.closedByRegister ?? "",
          returnClosedByRegister: lead.returnClosedByRegister ?? "",
          checkout: lead.checkout ?? "",
          ads: lead.ads ?? "",
          site: lead.site ?? "",
        });
      }
    }

    if (rows.length === 0) {
      return { addedEntries: 0 };
    }

    const insert = this.database.prepare(`
      INSERT INTO sales (
        shipping_date,
        status,
        good_category,
        good_sku,
        good_name,
        good_size,
        price,
        discount,
        customer_delivery_price,
        owner_delivery_price,
        owner_return_delivery_price,
        delivery_type,
        payment_type,
        lead_id,
        cdek_number,
        return_lead_id,
        return_cdek_number,
        closed_by_register,
        return_closed_by_register,
        checkout,
        ads,
        site
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return {
      addedEntries: this.database
        .transaction(() => {
          for (const row of rows) {
            insert.run(
              row.shippingDate,
              row.status,
              row.goodCategory,
              row.goodSku,
              row.goodName,
              row.goodSize,
              row.price,
              row.discount,
              row.customerDeliveryPrice,
              row.ownerDeliveryPrice,
              row.ownerReturnDeliveryPrice,
              row.deliveryType,
              row.paymentType,
              row.leadId,
              row.cdekNumber,
              row.returnLeadId,
              row.returnCdekNumber,
              row.closedByRegister,
              row.returnClosedByRegister,
              row.checkout,
              row.ads,
              row.site,
            );
          }

          return rows.length;
        })
        .immediate(),
    };
  }

  updateEntry(search: SalesSearch, update: SalesUpdate): SalesUpdateResult {
    return this.database
      .transaction(() => {
        const searchSql = this.buildSearch(search);
        if (!searchSql) {
          return { foundEntries: 0, updatedEntries: 0 };
        }

        const found = this.database
          .query<{ count: number }, string[]>(
            `SELECT COUNT(*) AS count FROM sales WHERE ${searchSql.clause}`,
          )
          .get(...searchSql.bindings);
        const foundEntries = found?.count ?? 0;

        const assignments: string[] = [];
        const updateBindings: (string | number | null)[] = [];

        for (const [field, column] of Object.entries(SalesTable.updateColumns)) {
          const value = update[field as keyof SalesUpdate];
          if (value === undefined) {
            continue;
          }

          assignments.push(`${column} = ?`);
          updateBindings.push(value);
        }

        if (assignments.length === 0) {
          return { foundEntries, updatedEntries: 0 };
        }

        const updated = this.database.run(
          `UPDATE sales SET ${assignments.join(", ")} WHERE ${searchSql.clause}`,
          [...updateBindings, ...searchSql.bindings],
        );

        return { foundEntries, updatedEntries: updated.changes };
      })
      .immediate();
  }

  cdekFullSuccess(leadId: string, paymentType?: string): SalesUpdateResult {
    return this.updateEntry(
      { leadId: [leadId] },
      {
        status: "Доставлено",
        paymentType,
      },
    );
  }

  cdekFullReturn(leadId: string): SalesUpdateResult {
    return this.updateEntry(
      { leadId: [leadId] },
      {
        status: "Ждем возврат",
        returnLeadId: leadId,
      },
    );
  }

  cdekPartialReturn(
    leadId: string,
    returnLeadId: string,
    goodSkuSuccess: string[],
    goodSkuReturn: string[],
    paymentType?: string,
  ): SalesUpdateResult {
    const successResult = this.updateEntry(
      { leadId: [leadId], goodSku: goodSkuSuccess },
      { status: "Доставлено", paymentType },
    );
    const returnResult = this.updateEntry(
      { leadId: [leadId], goodSku: goodSkuReturn },
      { status: "Ждем возврат", returnLeadId },
    );

    return {
      foundEntries: successResult.foundEntries + returnResult.foundEntries,
      updatedEntries: successResult.updatedEntries + returnResult.updatedEntries,
    };
  }

  cdekReturnCdekNumber(returnLeadId: string, returnCdekNumber: string): SalesUpdateResult {
    return this.updateEntry({ returnLeadId: [returnLeadId] }, { returnCdekNumber });
  }

  cdekReturnRecieved(returnLeadId: string): SalesUpdateResult {
    return this.updateEntry({ returnLeadId: [returnLeadId] }, { status: "Возврат получен" });
  }

  private buildSearch(search: SalesSearch): { clause: string; bindings: string[] } | undefined {
    const identifierSearches = [
      ["lead_id", search.leadId],
      ["return_lead_id", search.returnLeadId],
      ["cdek_number", search.cdekNumber],
      ["return_cdek_number", search.returnCdekNumber],
    ] as const;
    const clauses: string[] = [];
    const bindings: string[] = [];

    for (const [column, values] of identifierSearches) {
      if (values === undefined || values.length === 0) {
        continue;
      }

      clauses.push(`${column} IN (${values.map(() => "?").join(", ")})`);
      bindings.push(...values);
    }

    if (clauses.length === 0) {
      return undefined;
    }

    let clause = `(${clauses.join(" OR ")})`;
    if (search.goodSku !== undefined) {
      if (search.goodSku.length === 0) {
        clause += " AND 1 = 0";
      } else {
        clause += ` AND good_sku IN (${search.goodSku.map(() => "?").join(", ")})`;
        bindings.push(...search.goodSku);
      }
    }

    return { clause, bindings };
  }
}

export type SalesEntry = Partial<{
  shippingDate: number;
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

export type SalesLead = {
  shippingDate?: number;
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
};

export type SalesSearch = {
  leadId?: string[];
  returnLeadId?: string[];
  cdekNumber?: string[];
  returnCdekNumber?: string[];
  goodSku?: string[];
};

export type SalesUpdate = Omit<SalesEntry, "site">;

export type SalesUpdateResult = {
  foundEntries: number;
  updatedEntries: number;
};

export type AddResult = {
  addedEntries: number;
};

type SalesRow = {
  shippingDate: number | null;
  status: string;
  goodCategory: string;
  goodSku: string;
  goodName: string;
  goodSize: string;
  price: number;
  discount: string;
  customerDeliveryPrice: number | null;
  ownerDeliveryPrice: number | null;
  ownerReturnDeliveryPrice: number | null;
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
};
