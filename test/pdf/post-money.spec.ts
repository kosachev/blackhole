import { describe, expect, test } from "bun:test";
import { ConfigService } from "@nestjs/config";
import { PDFDocument } from "pdf-lib";
import { postMoney } from "../../src/pdf/lib/post-money";
import { PDFService } from "../../src/pdf/pdf.service";

describe("postal transfer amounts", () => {
  test("rounds floating point tails and separates rubles and kopecks", () => {
    expect(postMoney(1234.5600000000002)).toMatchObject({ sum: "1234", kop: "56" });
    expect(postMoney(1500)).toMatchObject({ sum: "1500", kop: "00" });
    expect(postMoney(99.99999999999999)).toMatchObject({ sum: "100", kop: "00" });
    expect(postMoney(0)).toMatchObject({ sum: "0", kop: "00" });
    expect(postMoney(999999.99)).toMatchObject({ sum: "999999", kop: "99" });
  });

  for (const amount of [NaN, Infinity, -1, 1000000]) {
    test(`rejects an amount outside the form limits: ${amount}`, () => {
      expect(() => postMoney(amount)).toThrow("Сумма почтового перевода");
    });
  }

  test("generates both postal forms for a fractional amount", async () => {
    const service = new PDFService(new ConfigService({}));
    await service.onModuleInit();
    const transfer = await service.post112p({ sum: 1234.5600000000002 });
    expect((await PDFDocument.load(transfer)).getPageCount()).toBe(1);
    const combined = await service.post7p112ep({
      recipient: "Тестовый Получатель",
      recipient_address: "Москва, Тестовая улица, 1",
      recipient_index: 123456,
      sum: 1500,
      sum_cash_on_delivery: 1234.5600000000002,
    });
    expect((await PDFDocument.load(combined)).getPageCount()).toBe(2);
  });
});
