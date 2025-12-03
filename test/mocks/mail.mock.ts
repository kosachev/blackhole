import { mock } from "bun:test";

export const createMailServiceMock = () => ({
  sendWelcome: mock((email: string, url: string) => [email, url]),
});
