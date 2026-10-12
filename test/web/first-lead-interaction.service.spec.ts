import { describe, expect, mock, test } from "bun:test";
import { AMO } from "../../src/amo/amo.constants";
import type { AmoService } from "../../src/amo/amo.service";
import type { UtmService } from "../../src/analytics/utm.service";
import { FirstLeadInteractionService } from "../../src/web/first-lead-interaction.service";

describe("FirstLeadInteractionService", () => {
  for (const userId of [AMO.USER.MANAGER1, AMO.USER.MANAGER2, AMO.USER.MANAGER3, AMO.USER.ADMIN, 999]) {
    test(`sets responsible only for a configured manager: ${userId}`, async () => {
      const updateLeadById = mock(async (_id: number, _data: unknown) => {});
      const addNotes = mock(async (_entity: string, _notes: unknown) => {});
      const updateContactById = mock(async (_id: number, _data: unknown) => {});
      const amo = { client: {
        lead: { updateLeadById },
        contact: { updateContactById },
        note: { addNotes },
      } } as unknown as AmoService;
      const service = new FirstLeadInteractionService(amo, {} as UtmService);
      await service.handler({
        leadId: 100,
        contactId: 200,
        userId,
        userName: "Test manager",
        dateCreate: Date.now() - 60_000,
        channel: "unknown",
      });
      expect(updateLeadById).toHaveBeenCalledTimes(1);
      const update = updateLeadById.mock.calls[0][1];
      if (userId === AMO.USER.ADMIN || userId === 999) {
        expect(update).not.toHaveProperty("responsible_user_id");
        expect(updateContactById).not.toHaveBeenCalled();
      } else {
        expect(update).toHaveProperty("responsible_user_id", userId);
        expect(updateContactById).toHaveBeenCalledTimes(1);
        expect(updateContactById).toHaveBeenCalledWith(200, { responsible_user_id: userId });
      }
      expect(update).toHaveProperty("custom_fields_values");
      expect(addNotes).toHaveBeenCalledTimes(1);
    });
  }

  test("supports requests without a contact ID", async () => {
    const updateLeadById = mock(async () => {});
    const updateContactById = mock(async () => {});
    const amo = { client: {
      lead: { updateLeadById },
      contact: { updateContactById },
      note: { addNotes: mock(async () => {}) },
    } } as unknown as AmoService;
    await new FirstLeadInteractionService(amo, {} as UtmService).handler({
      leadId: 100,
      userId: AMO.USER.MANAGER1,
      userName: "Test manager",
      dateCreate: Date.now() - 60_000,
      channel: "unknown",
    });
    expect(updateLeadById).toHaveBeenCalledTimes(1);
    expect(updateContactById).not.toHaveBeenCalled();
  });

  for (const contactId of [0, -1, 1.5, NaN, Infinity, "200", null]) {
    test(`rejects invalid contact ID before updating amoCRM: ${contactId}`, async () => {
      const updateLeadById = mock(async () => {});
      const amo = { client: { lead: { updateLeadById } } } as unknown as AmoService;
      const service = new FirstLeadInteractionService(amo, {} as UtmService);
      await expect(service.handler({
        leadId: 100,
        contactId: contactId as number,
        userId: AMO.USER.MANAGER1,
        userName: "Test manager",
        dateCreate: Date.now() - 60_000,
        channel: "unknown",
      })).rejects.toThrow("Invalid contactId");
      expect(updateLeadById).not.toHaveBeenCalled();
    });
  }
});
