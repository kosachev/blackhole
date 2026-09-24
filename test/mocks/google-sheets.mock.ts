import { mock } from "bun:test";

export const createGoogleSheetsServiceMock = () => ({
  sales: {
    addLead: mock(async (lead: { goods?: { quantity?: number }[] }) => ({
      addedEntries: (lead.goods ?? []).reduce((count, good) => count + (good.quantity ?? 1), 0),
    })),
    updateEntry: mock(async () => ({ foundEntries: 1, updatedEntries: 1 })),
    cdekFullSuccess: mock(async () => ({ foundEntries: 1, updatedEntries: 1 })),
    cdekFullReturn: mock(async () => ({ foundEntries: 1, updatedEntries: 1 })),
    cdekPartialReturn: mock(async () => ({ foundEntries: 2, updatedEntries: 2 })),
    cdekReturnCdekNumber: mock(async () => ({ foundEntries: 1, updatedEntries: 1 })),
    cdekReturnRecieved: mock(async () => ({ foundEntries: 1, updatedEntries: 1 })),
    save: mock(async () => undefined),
  },
  spendings: {
    addSpendings: mock(async (rows: unknown[]) => ({ addedRows: rows.length })),
  },
  kpi: {
    addKpi: mock(async (rows: unknown[]) => ({ addedRows: rows.length })),
  },
  cdekPrice: {
    getCdekDelta: mock(async () => 0),
  },
});
