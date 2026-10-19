import { mock } from "bun:test";

export const createDbServiceMock = () => ({
  sales: {
    addLead: mock(() => ({ addedEntries: 0 })),
    updateEntry: mock(() => ({ foundEntries: 0, updatedEntries: 0 })),
    findByShippingDateRange: mock(() => []),
    cdekFullSuccess: mock(() => ({ foundEntries: 0, updatedEntries: 0 })),
    cdekFullReturn: mock(() => ({ foundEntries: 0, updatedEntries: 0 })),
    cdekPartialReturn: mock(() => ({ foundEntries: 0, updatedEntries: 0 })),
    cdekReturnCdekNumber: mock(() => ({ foundEntries: 0, updatedEntries: 0 })),
    cdekReturnRecieved: mock(() => ({ foundEntries: 0, updatedEntries: 0 })),
  },
  spendings: {
    addSpendings: mock(() => ({ addedRows: 0 })),
  },
  kpi: {
    getKpi: mock(() => []),
    addKpi: mock(() => ({ addedRows: 0 })),
  },
  cdekPrice: {
    getCdekDelta: mock(() => undefined),
    setCdekDelta: mock(() => undefined),
  },
});
