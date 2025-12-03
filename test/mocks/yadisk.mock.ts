import { vi } from "bun:test";

export const mockYandexDiskService = () => {
  vi.mock("../../src/yandex-disk/yandex-disk.service", () => {
    return {
      YandexDiskService: vi.fn().mockImplementation(() => {
        return {
          upload: {},
        };
      }),
    };
  });
};
