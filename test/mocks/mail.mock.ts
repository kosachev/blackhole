import { vi } from "vitest";

export const mockMailService = () => {
  vi.mock("../../src/mail/mail.service", () => {
    return {
      MailService: vi.fn().mockImplementation(() => {
        return {
          sendWelcome: vi.fn((email: string, url: string) => [email, url]),
        };
      }),
    };
  });
};
