import { mock } from "bun:test";

export const createGoogleSheetsServiceMock = () => ({
  sales: {
    logger: {
      log: mock((...data: any[]) => [data]),
      error: mock((...data: any[]) => [data]),
    },
    addLead: mock((...data: any[]) => [data]),
    updateEntry: mock((...data: any[]) => [data]),
    cdekFullSuccess: mock((...data: any[]) => [data]),
    cdekFullReturn: mock((...data: any[]) => [data]),
    cdekPartialReturn: mock((...data: any[]) => [data]),
    cdekReturnCdekNumberAndDeliveryPrice: mock((...data: any[]) => [data]),
    cdekGoogleSheetsUpdate: mock((...data: any[]) => [data]),
    cdekReturnRecieved: mock((...data: any[]) => [data]),
  },
});
