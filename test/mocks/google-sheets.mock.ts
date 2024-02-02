import { vi } from "vitest";

export const mockGoogleSheetsService = () => {
  vi.mock("../../src/google-sheets/google-sheets.service", () => {
    return {
      GoogleSheetsService: vi.fn().mockImplementation(() => {
        return {
          addSell: vi.fn((data: any) => [data]),
        };
      }),
    };
  });
};
