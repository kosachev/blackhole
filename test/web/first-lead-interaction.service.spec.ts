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
      const amo = { client: {
        lead: { updateLeadById },
        note: { addNotes },
      } } as unknown as AmoService;
      const service = new FirstLeadInteractionService(amo, {} as UtmService);
      await service.handler({
        leadId: 100,
        userId,
        userName: "Test manager",
        dateCreate: Date.now() - 60_000,
        channel: "unknown",
      });
      expect(updateLeadById).toHaveBeenCalledTimes(1);
      const update = updateLeadById.mock.calls[0][1];
      if (userId === AMO.USER.ADMIN || userId === 999) {
        expect(update).not.toHaveProperty("responsible_user_id");
      } else {
        expect(update).toHaveProperty("responsible_user_id", userId);
      }
      expect(update).toHaveProperty("custom_fields_values");
      expect(addNotes).toHaveBeenCalledTimes(1);
    });
  }
});
