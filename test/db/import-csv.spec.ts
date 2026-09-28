import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importCsvFiles, parseCsv } from "../../scripts/import-db-csv";

describe("CSV DB import", () => {
  let directory: string;
  let dbPath: string;
  let database: Database | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "gerda-csv-"));
    dbPath = join(directory, "gerda.db");
    await Promise.all([
      Bun.write(
        join(directory, "ЖУРНАЛ ПРОДАЖ - Sales.csv"),
        'Дата,Статус,Категория,Артикул,Название,Размер,Цена,Скидка,Доставка клиенту,Доставка нам,Возврат,Вид доставки,Вид оплаты,Сделка,Трек,Сделка возврата,Трек возврата,Реестр,Реестр возврата,Касса,ADS,Сайт\n01.02.2026,,,001005,"Платье, ""Крис""",M,19900,,700,,,"Курьером",Наличные,40396071,,,,,,,mobile,Gerda\n',
      ),
      Bun.write(
        join(directory, "ЖУРНАЛ ПРОДАЖ - Spendings.csv"),
        'Дата,Описание,Стоимость\n17.11.2025,Забор товара,"590,50"\n',
      ),
      Bun.write(
        join(directory, "ЖУРНАЛ ПРОДАЖ - KPI.csv"),
        "Дата достижения,Дата создания,Сделка,Ответственный,Кто перевел,Тип,Сумма\n03.09.2026 13:12,03.09.2026 12:37,40755791,Manager-3,Manager-3,delivery,7900\n",
      ),
    ]);
  });

  afterEach(() => {
    database?.close();
    database = undefined;
  });

  test("parses quoted fields, commas, quotes and newlines", () => {
    expect(parseCsv('a,"b,c","d""e"\n"multi\nline",f,g\r\n')).toEqual([
      ["a", "b,c", 'd"e'],
      ["multi\nline", "f", "g"],
    ]);
  });

  test("imports all CSV tables and converts values", async () => {
    const result = await importCsvFiles({ csvDirectory: directory, dbPath });

    expect(result).toEqual({
      dbPath,
      sales: 1,
      spendings: 1,
      kpi: 1,
    });

    database = new Database(dbPath);
    expect(database.query("SELECT * FROM sales").get()).toEqual({
      id: 1,
      shipping_date: new Date(2026, 1, 1).getTime() / 1000,
      status: "",
      good_category: "",
      good_sku: "001005",
      good_name: 'Платье, "Крис"',
      good_size: "M",
      price: 19900,
      discount: "",
      customer_delivery_price: 700,
      owner_delivery_price: null,
      owner_return_delivery_price: null,
      delivery_type: "Курьером",
      payment_type: "Наличные",
      lead_id: "40396071",
      cdek_number: "",
      return_lead_id: "",
      return_cdek_number: "",
      closed_by_register: "",
      return_closed_by_register: "",
      checkout: "",
      ads: "mobile",
      site: "Gerda",
    });
    expect(database.query("SELECT * FROM spendings").get()).toEqual({
      id: 1,
      date: new Date(2025, 10, 17).getTime() / 1000,
      description: "Забор товара",
      amount: 590.5,
    });
    expect(database.query("SELECT * FROM kpi").get()).toEqual({
      id: 1,
      kpi_reached_at: new Date(2026, 8, 3, 13, 12).getTime() / 1000,
      lead_created_at: new Date(2026, 8, 3, 12, 37).getTime() / 1000,
      lead_id: "40755791",
      responsible_user: "Manager-3",
      status_user: "Manager-3",
      kpi_type: "delivery",
      price: 7900,
    });
    database.close();
    database = undefined;
  });

  test("rejects duplicate import unless replace is enabled", async () => {
    await importCsvFiles({ csvDirectory: directory, dbPath });

    await expect(importCsvFiles({ csvDirectory: directory, dbPath })).rejects.toThrow(
      "Database already contains imported rows; use --replace to overwrite them",
    );
    await importCsvFiles({ csvDirectory: directory, dbPath, replace: true });

    database = new Database(dbPath);
    expect(database.query("SELECT COUNT(*) AS count FROM sales").get()).toEqual({ count: 1 });
    expect(database.query("SELECT COUNT(*) AS count FROM spendings").get()).toEqual({ count: 1 });
    expect(database.query("SELECT COUNT(*) AS count FROM kpi").get()).toEqual({ count: 1 });
    database.close();
    database = undefined;
  });
});
