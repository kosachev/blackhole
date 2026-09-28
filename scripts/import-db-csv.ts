import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { applyMigrations } from "../src/db/db.service";
import migration from "../src/db/migration.sql" with { type: "text" };

const files = {
  sales: "ЖУРНАЛ ПРОДАЖ - Sales.csv",
  spendings: "ЖУРНАЛ ПРОДАЖ - Spendings.csv",
  kpi: "ЖУРНАЛ ПРОДАЖ - KPI.csv",
} as const;

type CsvFile = keyof typeof files;

type ImportOptions = {
  csvDirectory: string;
  dbPath: string;
  replace?: boolean;
};

type ImportResult = Record<CsvFile, number> & { dbPath: string };

type SalesRow = {
  shippingDate: number | null;
  status: string;
  goodCategory: string;
  goodSku: string;
  goodName: string;
  goodSize: string;
  price: number | null;
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

type SpendingRow = {
  date: number | null;
  description: string;
  amount: number | null;
};

type KpiRow = {
  kpiReachedAt: number | null;
  leadCreatedAt: number | null;
  leadId: string;
  responsibleUser: string;
  statusUser: string;
  kpiType: string;
  price: number | null;
};

export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const input = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  for (let index = 0; index < input.length; index++) {
    const character = input[index];

    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unclosed quoted field");
  }

  if (value !== "" || row.length > 0) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function text(value: string | undefined): string {
  return (value ?? "").trim();
}

function number(value: string | undefined, field: string): number | null {
  const normalized = text(value).replaceAll(/\s/g, "").replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number in ${field}: ${value}`);
  }
  return parsed;
}

function date(value: string | undefined, field: string): number | null {
  const normalized = text(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) {
    throw new Error(`Invalid date in ${field}: ${value}`);
  }

  const [, day, month, year, hour = "0", minute = "0"] = match;
  const result = new Date(
    +year,
    +month - 1,
    +day,
    +hour,
    +minute,
    0,
    0,
  );
  if (Number.isNaN(result.getTime())) {
    throw new Error(`Invalid date in ${field}: ${value}`);
  }

  return Math.floor(result.getTime() / 1000);
}

function parseSales(source: string): SalesRow[] {
  const rows = parseCsv(source).slice(1);
  return rows.map((row) => ({
    shippingDate: date(row[0], "Sales.shippingDate"),
    status: text(row[1]),
    goodCategory: text(row[2]),
    goodSku: text(row[3]),
    goodName: text(row[4]),
    goodSize: text(row[5]),
    price: number(row[6], "Sales.price"),
    discount: text(row[7]),
    customerDeliveryPrice: number(row[8], "Sales.customerDeliveryPrice"),
    ownerDeliveryPrice: number(row[9], "Sales.ownerDeliveryPrice"),
    ownerReturnDeliveryPrice: number(row[10], "Sales.ownerReturnDeliveryPrice"),
    deliveryType: text(row[11]),
    paymentType: text(row[12]),
    leadId: text(row[13]),
    cdekNumber: text(row[14]),
    returnLeadId: text(row[15]),
    returnCdekNumber: text(row[16]),
    closedByRegister: text(row[17]),
    returnClosedByRegister: text(row[18]),
    checkout: text(row[19]),
    ads: text(row[20]),
    site: text(row[21]),
  }));
}

function parseSpendings(source: string): SpendingRow[] {
  return parseCsv(source)
    .slice(1)
    .map((row) => ({
      date: date(row[0], "Spendings.date"),
      description: text(row[1]),
      amount: number(row[2], "Spendings.amount"),
    }));
}

function parseKpi(source: string): KpiRow[] {
  return parseCsv(source)
    .slice(1)
    .map((row) => ({
      kpiReachedAt: date(row[0], "Kpi.kpiReachedAt"),
      leadCreatedAt: date(row[1], "Kpi.leadCreatedAt"),
      leadId: text(row[2]),
      responsibleUser: text(row[3]),
      statusUser: text(row[4]),
      kpiType: text(row[5]),
      price: number(row[6], "Kpi.price"),
    }));
}

export async function importCsvFiles(options: ImportOptions): Promise<ImportResult> {
  const csvDirectory = resolve(options.csvDirectory);
  const dbPath = resolve(options.dbPath);
  const [salesSource, spendingsSource, kpiSource] = await Promise.all([
    Bun.file(resolve(csvDirectory, files.sales)).text(),
    Bun.file(resolve(csvDirectory, files.spendings)).text(),
    Bun.file(resolve(csvDirectory, files.kpi)).text(),
  ]);
  const sales = parseSales(salesSource);
  const spendings = parseSpendings(spendingsSource);
  const kpi = parseKpi(kpiSource);

  await mkdir(dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);

  try {
    database.exec("PRAGMA journal_mode = DELETE; PRAGMA busy_timeout = 5000;");
    applyMigrations(database, migration);

    database
      .transaction(() => {
        const existing =
          (database.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM sales").get()
            ?.count ?? 0) +
          (database.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM spendings").get()
            ?.count ?? 0) +
          (database.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM kpi").get()?.count ??
            0);

        if (existing > 0 && !options.replace) {
          throw new Error("Database already contains imported rows; use --replace to overwrite them");
        }

        if (options.replace) {
          database.exec("DELETE FROM sales; DELETE FROM spendings; DELETE FROM kpi;");
        }

        const insertSales = database.prepare(`
          INSERT INTO sales (
            shipping_date, status, good_category, good_sku, good_name, good_size, price,
            discount, customer_delivery_price, owner_delivery_price, owner_return_delivery_price,
            delivery_type, payment_type, lead_id, cdek_number, return_lead_id, return_cdek_number,
            closed_by_register, return_closed_by_register, checkout, ads, site
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const row of sales) {
          insertSales.run(
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

        const insertSpendings = database.prepare(
          "INSERT INTO spendings (date, description, amount) VALUES (?, ?, ?)",
        );
        for (const row of spendings) {
          insertSpendings.run(row.date, row.description, row.amount);
        }

        const insertKpi = database.prepare(`
          INSERT INTO kpi (
            kpi_reached_at, lead_created_at, lead_id, responsible_user, status_user, kpi_type, price
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const row of kpi) {
          insertKpi.run(
            row.kpiReachedAt,
            row.leadCreatedAt,
            row.leadId,
            row.responsibleUser,
            row.statusUser,
            row.kpiType,
            row.price,
          );
        }
      })
      .immediate();

    return { dbPath, sales: sales.length, spendings: spendings.length, kpi: kpi.length };
  } finally {
    database.close();
  }
}

if (import.meta.main) {
  const dbArgument = process.argv.find((argument) => argument.startsWith("--db="));
  const replace = process.argv.includes("--replace");
  const dbPath = dbArgument?.slice("--db=".length) ?? process.env.DB_PATH ?? "./data/gerda.db";

  importCsvFiles({ csvDirectory: process.cwd(), dbPath, replace })
    .then((result) => {
      console.log(
        `Imported Sales=${result.sales}, Spendings=${result.spendings}, KPI=${result.kpi} into ${result.dbPath}`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
