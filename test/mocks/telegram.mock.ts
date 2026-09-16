import { mock } from "bun:test";

export const createTelegramServiceMock = () => ({
  textToAdmin: mock(async (text: string) => [text]),
  textToManager: mock(async (text: string) => [text]),
  api: {},
  // TelegramController's constructor calls webhookCallback(bot), which only
  // touches bot.isRunning() at setup time; the rest is lazy per-request.
  bot: {
    isRunning: mock(() => false),
  },
});
