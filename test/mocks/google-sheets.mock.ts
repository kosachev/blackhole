import { vi } from "vitest";

export const mockGoogleSheetsService = () => {
  vi.mock("../../src/google-sheets/google-sheets.service", () => {
    return {
      GoogleSheetsService: vi.fn().mockImplementation(() => {
        return {
          logger: {
            log: vi.fn((...data: any[]) => [data]),
            error: vi.fn((...data: any[]) => [data]),
          },
          addLead: vi.fn((...data: any[]) => [data]),
          updateEntry: vi.fn((...data: any[]) => [data]),
          cdekFullSuccess: vi.fn((...data: any[]) => [data]),
          cdekFullReturn: vi.fn((...data: any[]) => [data]),
          cdekPartialReturn: vi.fn((...data: any[]) => [data]),
          cdekReturnCdekNumberAndDeliveryPrice: vi.fn((...data: any[]) => [data]),
          cdekGoogleSheetsUpdate: vi.fn((...data: any[]) => [data]),
          cdekReturnRecieved: vi.fn((...data: any[]) => [data]),
        };
      }),
    };
  });
};
