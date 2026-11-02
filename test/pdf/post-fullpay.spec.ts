import { expect, mock, spyOn, test } from "bun:test";
import { ConfigService } from "@nestjs/config";
import { PDFDocument } from "pdf-lib";
import { AMO } from "../../src/amo/amo.constants";
import { LeadStatusWebhook } from "../../src/amo/webhooks/lead-status.webhook";
import { PDFService } from "../../src/pdf/pdf.service";

for (const fullpay of ["1", true, "0", false, undefined]) {
  test(`postal form selection for FULLPAY=${fullpay}`, async () => {
    const post7p = mock(async (_params: unknown) => new Uint8Array([1]));
    const post7p112ep = mock(async (_params: unknown) => new Uint8Array([2]));
    const upload = mock(async () => "https://example.com/post.pdf");
    const note = mock((_text: string) => {});
    const handler = Object.assign(Object.create(LeadStatusWebhook.prototype), {
      validation: () => {},
      pdf: { post7p, post7p112ep },
      yadisk: { upload },
      logger: { log: mock(() => {}), error: mock(() => {}) },
    });
    await handler.statusPost({
      custom_fields: new Map<number, unknown>([
        [AMO.CUSTOM_FIELD.FULLPAY, fullpay],
        [AMO.CUSTOM_FIELD.PREPAY, "30200"],
        [AMO.CUSTOM_FIELD.DELIVERY_COST, "2298.9"],
        [AMO.CUSTOM_FIELD.INDEX, "694920"],
        [AMO.CUSTOM_FIELD.ORDER_ID, "40840773"],
      ]),
      data: { id: 40840773 },
      errors: [], warnings: [], note,
      contact: { name: "Тестовый Получатель" },
      getFullAddress: () => "Москва, Тестовая улица, 1",
      getStripedPhone: () => "9990000000",
      totalPrice: () => 27900,
      getAbsoluteDiscount: () => 0,
    });
    expect(post7p).not.toHaveBeenCalled();
    expect(post7p112ep).toHaveBeenCalledTimes(1);
    const amount = fullpay === "1" || fullpay === true ? 0 : 27900 + 2298.9 - 30200;
    expect(post7p112ep).toHaveBeenCalledWith(expect.objectContaining({
      sum: 27900, sum_cash_on_delivery: amount, recipient_index: 694920,
    }));
    expect(upload).toHaveBeenCalledTimes(1);
    expect(note).toHaveBeenCalledWith("✎ Сформирован почтовый бланк: https://example.com/post.pdf");
  });
}

test("fully paid postal forms include both pages with zero payment", async () => {
  const service = new PDFService(new ConfigService({
    OWNER_SHORT_NAME: "Тестовый Отправитель",
    OWNER_POST_ADDRESS: "г. Москва (до востребования)",
    OWNER_POST_INDEX: "115563",
  }));
  await service.onModuleInit();
  const builder = (service as unknown as { builder: {
    fillPost7pDoc: (...args: any[]) => Promise<PDFDocument>;
    fillPost112epDoc: (...args: any[]) => Promise<PDFDocument>;
  } }).builder;
  const labelSpy = spyOn(builder, "fillPost7pDoc");
  const transferSpy = spyOn(builder, "fillPost112epDoc");
  const bytes = await service.post7p112ep({
    recipient: "Тестовый Получатель",
    recipient_address: "Москва, Тестовая улица, 1",
    recipient_index: 123456,
    recipient_phone: 9990000000,
    sum: 27900,
    sum_cash_on_delivery: 0,
  });
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  expect(labelSpy).toHaveBeenCalledWith(expect.objectContaining({
    sum_cash_on_delivery: "0 ноль рублей 00 копеек",
  }));
  expect(transferSpy).toHaveBeenCalledWith(expect.objectContaining({
    sum: "0", kop: "00", sum_words: "ноль рублей 00 копеек",
  }));
  labelSpy.mockRestore();
  transferSpy.mockRestore();
});
