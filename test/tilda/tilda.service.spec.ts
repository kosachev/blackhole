import { describe, expect, mock, test } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import { AMO } from "../../src/amo/amo.constants";
import type { AmoService } from "../../src/amo/amo.service";
import { CallRequestService } from "../../src/amo/call-request.service";
import type { LeadCreateService } from "../../src/amo/lead-create.service";
import { TildaService, type TildaWebhookData } from "../../src/tilda/tilda.service";

function setup() {
  const addComplex = mock(async (_leads: any[]) => [{ id: 123 }]);
  const amo = { client: { lead: { addComplex } } } as unknown as AmoService;
  const calls = new CallRequestService(amo);
  const leadCreateHandler = mock(async (_order: unknown) => {});
  const service = new TildaService({ leadCreateHandler } as unknown as LeadCreateService, calls);
  return { addComplex, calls, leadCreateHandler, service };
}

const inquiry: TildaWebhookData = {
  Name: "Тестовая заявка",
  Phone: "+7 (000) 000-00-00",
  Textarea: "Нужна консультация",
  Checkbox: "yes",
  ymclientid: "test",
  formid: "form2266034201",
  sigma: "test-only",
};

describe("Tilda inquiries and orders", () => {
  test("creates a callback lead with a linked contact and both tags", async () => {
    const { service, addComplex, leadCreateHandler } = setup();
    await service.handler(inquiry, {} as Headers);
    expect(leadCreateHandler).not.toHaveBeenCalled();
    expect(addComplex).toHaveBeenCalledTimes(1);
    const lead = addComplex.mock.calls[0][0][0];
    expect(lead.name).toBe("Звонок Тестовая заявка");
    expect(lead.tags_to_add).toEqual([{ id: AMO.TAG.CALL_REQUEST }, { id: AMO.TAG.TILDA }]);
    expect(lead._embedded.contacts).toEqual([{
      name: inquiry.Name,
      custom_fields_values: [{ field_id: AMO.CONTACT.PHONE, values: [{ value: "70000000000" }] }],
    }]);
    expect(lead.custom_fields_values).toContainEqual({
      field_id: AMO.CUSTOM_FIELD.COMMENT_CLIENT,
      values: [{ value: inquiry.Textarea }],
    });
  });

  test("accepts alternate name and phone fields", async () => {
    const { service, addComplex } = setup();
    await service.handler({ ...inquiry, Name: undefined, Phone: undefined,
      name: "  Тест  ", fastphone: "+7 000 000 00 00" }, {} as Headers);
    expect(addComplex.mock.calls[0][0][0].name).toBe("Звонок Тест");
  });

  test("rejects an inquiry without a usable phone before calling amoCRM", async () => {
    const { service, addComplex } = setup();
    await expect(service.handler({ ...inquiry, Phone: "---" }, {} as Headers))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(addComplex).not.toHaveBeenCalled();
  });

  test("propagates amoCRM failure", async () => {
    const { service, addComplex } = setup();
    addComplex.mockImplementation(async () => { throw new Error("amo unavailable"); });
    await expect(service.handler(inquiry, {} as Headers)).rejects.toThrow("amo unavailable");
  });

  test("keeps ordinary callback tags unchanged", async () => {
    const { calls, addComplex } = setup();
    await calls.callRequesthandler({ name: "Тест", phone: "70000000000" });
    expect(addComplex.mock.calls[0][0][0].tags_to_add).toEqual([{ id: AMO.TAG.CALL_REQUEST }]);
  });

  test("routes a cart order through the existing order service", async () => {
    const { service, addComplex, leadCreateHandler } = setup();
    await service.handler({ ...inquiry, delivery: "Самовывоз", payment: {
      sys: "cash", systranid: "test", orderid: "123", amount: "100",
      products: [{ name: "Тестовый товар", quantity: 1, amount: 100,
        price: "100", sku: "TEST", options: [] }],
    } }, {} as Headers);
    expect(addComplex).not.toHaveBeenCalled();
    expect(leadCreateHandler).toHaveBeenCalledTimes(1);
    expect(leadCreateHandler.mock.calls[0][0]).toMatchObject({
      name: "Тильда 123", tag: ["TILDA"],
      goods: [{ name: "Тестовый товар", quantity: 1, price: 100, sku: "TEST" }],
    });
  });

  for (const payment of [{}, { products: [] }, "", false]) {
    test(`rejects malformed payment ${JSON.stringify(payment)} instead of creating a callback`, async () => {
      const { service, addComplex, leadCreateHandler } = setup();
      await expect(service.handler({ ...inquiry, payment } as TildaWebhookData, {} as Headers))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(addComplex).not.toHaveBeenCalled();
      expect(leadCreateHandler).not.toHaveBeenCalled();
    });
  }
});
