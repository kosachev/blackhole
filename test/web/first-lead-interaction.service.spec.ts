import { describe, expect, mock, test } from "bun:test";
import { AMO } from "../../src/amo/amo.constants";
import type { AmoService } from "../../src/amo/amo.service";
import type { UtmService } from "../../src/analytics/utm.service";
import { FirstLeadInteractionService } from "../../src/web/first-lead-interaction.service";

const request = () => ({
  leadId: 100,
  userId: 200,
  userName: "Test manager",
  dateCreate: Date.now() - 60_000,
  channel: "unknown",
});

function setup(contacts?: { id: number; is_main: boolean }[], recorded = false) {
  const calls: string[] = [];
  const getLeadById = mock(async () => ({
    _embedded: contacts === undefined ? undefined : { contacts },
    custom_fields_values: recorded
      ? [{ field_id: AMO.CUSTOM_FIELD.FIRST_TIME_INTERACTION, values: [{ value: "24.09.2026 12:00" }] }]
      : null,
  }));
  const updateContactById = mock(async (_id: number, _data: unknown) => { calls.push("contact"); });
  const updateLeadById = mock(async (_id: number, _data: unknown) => { calls.push("lead"); });
  const addNotes = mock(async (_entity: string, _notes: unknown) => { calls.push("note"); });
  const amo = { client: {
    lead: { getLeadById, updateLeadById },
    contact: { updateContactById },
    note: { addNotes },
  } } as unknown as AmoService;
  const service = new FirstLeadInteractionService(amo, { get: () => undefined } as unknown as UtmService);
  return { service, calls, getLeadById, updateContactById, updateLeadById, addNotes };
}

describe("FirstLeadInteractionService", () => {
  test("assigns only the main contact and the lead before writing the note", async () => {
    const ctx = setup([{ id: 301, is_main: false }, { id: 302, is_main: true }]);
    await ctx.service.handler(request());
    expect(ctx.calls).toEqual(["contact", "lead", "note"]);
    expect(ctx.getLeadById).toHaveBeenCalledWith(100, { with: ["contacts"] });
    expect(ctx.updateContactById).toHaveBeenCalledTimes(1);
    expect(ctx.updateContactById).toHaveBeenCalledWith(302, { responsible_user_id: 200 });
    expect(ctx.updateLeadById).toHaveBeenCalledWith(100, expect.objectContaining({
      responsible_user_id: 200,
      custom_fields_values: expect.arrayContaining([
        { field_id: AMO.CUSTOM_FIELD.FIRST_TIME_INTERACTION, values: [{ value: expect.any(String) }] },
      ]),
    }));
    expect(ctx.addNotes).toHaveBeenCalledWith("leads", [expect.objectContaining({ entity_id: 100, note_type: "common" })]);
  });

  for (const contacts of [undefined, [], [{ id: 301, is_main: false }]]) {
    test(`continues without a main contact: ${JSON.stringify(contacts)}`, async () => {
      const ctx = setup(contacts);
      await ctx.service.handler(request());
      expect(ctx.calls).toEqual(["lead", "note"]);
      expect(ctx.updateContactById).not.toHaveBeenCalled();
    });
  }

  test("waits for contact assignment to finish", async () => {
    const ctx = setup([{ id: 301, is_main: true }]);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    ctx.updateContactById.mockImplementation(async () => { await pending; });
    const result = ctx.service.handler(request());
    await Promise.resolve();
    expect(ctx.updateContactById).toHaveBeenCalledTimes(1);
    expect(ctx.updateLeadById).not.toHaveBeenCalled();
    expect(ctx.addNotes).not.toHaveBeenCalled();
    release();
    await result;
    expect(ctx.calls).toEqual(["lead", "note"]);
  });

  for (const step of ["getLeadById", "updateContactById", "updateLeadById"] as const) {
    test(`does not record interaction if ${step} fails`, async () => {
      const ctx = setup([{ id: 301, is_main: true }]);
      ctx[step].mockImplementation(async () => { throw new Error("API failure"); });
      await expect(ctx.service.handler(request())).rejects.toThrow("API failure");
      expect(ctx.addNotes).not.toHaveBeenCalled();
      if (step !== "updateLeadById") expect(ctx.updateLeadById).not.toHaveBeenCalled();
    });
  }

  test("does not reassign or add a note for an already recorded interaction", async () => {
    const ctx = setup([{ id: 301, is_main: true }], true);
    await ctx.service.handler(request());
    expect(ctx.calls).toEqual([]);
  });

  for (const userId of [0, -1, 1.5, NaN, undefined, "200"]) {
    test(`rejects invalid userId ${userId} before accessing CRM`, async () => {
      const ctx = setup();
      await expect(ctx.service.handler({ ...request(), userId: userId as number })).rejects.toThrow("Invalid data");
      expect(ctx.getLeadById).not.toHaveBeenCalled();
    });
  }
});
