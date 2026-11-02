import { expect, mock, test } from "bun:test";
import { ConfigService } from "@nestjs/config";
import type { AmoService } from "../../src/amo/amo.service";
import { AMO } from "../../src/amo/amo.constants";
import type { TBankService } from "../../src/tbank/tbank.service";
import { NotificationPaymentWebhook } from "../../src/tbank/webhooks/notification-payment.webhook";
import type { TelegramService } from "../../src/telegram/telegram.service";

for (const status of Object.values(AMO.STATUS)) {
  test(`confirmed payment changes stage only from Requisite: ${status}`, async () => {
    const leadId = 40840773;
    const getLeadById = mock(async (_id: number) => ({ id: leadId, status_id: status }));
    const updateLeadById = mock(async (_id: number, _data: unknown) => {});
    const addNotes = mock(async (_entity: string, _notes: unknown) => {});
    const addTasks = mock(async (_tasks: unknown) => {});
    const textToManager = mock(async (_text: string) => {});
    const amo = { client: {
      lead: { getLeadById, updateLeadById },
      note: { addNotes },
      task: { addTasks },
    } } as unknown as AmoService;
    const webhook = new NotificationPaymentWebhook(
      new ConfigService({ AMO_DOMAIN: "example.amocrm.ru" }),
      amo,
      { checkToken: () => true } as unknown as TBankService,
      { textToManager } as unknown as TelegramService,
    );

    await webhook.handler({
      Token: "valid-token",
      Status: "CONFIRMED",
      OrderId: `${leadId}-2`,
      PaymentId: 9552947132,
      Amount: 3020000,
      Pan: "SberPay_account",
    });

    expect(getLeadById).toHaveBeenCalledWith(leadId);
    expect(updateLeadById).toHaveBeenCalledTimes(1);
    const [updatedId, update] = updateLeadById.mock.calls[0] as [number, Record<string, unknown>];
    expect(updatedId).toBe(leadId);
    if (status === AMO.STATUS.REQUISITE) {
      expect(update.status_id).toBe(AMO.STATUS.PAYMENT);
    } else {
      expect(update).not.toHaveProperty("status_id");
    }
    expect(update.custom_fields_values).toEqual([
      { field_id: AMO.CUSTOM_FIELD.BANK_STATUS, values: [{ value: "CONFIRMED" }] },
      { field_id: AMO.CUSTOM_FIELD.BANK_PAYMENTID, values: [{ value: "9552947132" }] },
      { field_id: AMO.CUSTOM_FIELD.BANK_ORDERID, values: [{ value: `${leadId}-2` }] },
      { field_id: AMO.CUSTOM_FIELD.BANK_PAN, values: [{ value: "SberPay_account" }] },
    ]);
    expect(update.tags_to_add).toEqual([{ id: AMO.TAG.DELIVERY_PAID }]);
    expect(addNotes).toHaveBeenCalledWith("leads", [expect.objectContaining({
      entity_id: leadId,
      params: { text: expect.stringContaining("Сумма: 30200 руб.") },
    })]);
    expect(textToManager).toHaveBeenCalledWith(expect.stringContaining(`/leads/detail/${leadId}`));
    expect(addTasks).not.toHaveBeenCalled();
  });
}
