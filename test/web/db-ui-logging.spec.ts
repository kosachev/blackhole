import { expect, spyOn, test } from "bun:test";
import { Logger } from "@nestjs/common";
import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { LoggerMiddleware } from "../../src/utils/logger.middleware";

test("HTTP logs omit login passwords and issued tokens without mutating headers", () => {
  const debug = spyOn(Logger.prototype, "debug").mockImplementation(() => {});
  try {
    const request = {
      method: "POST", path: "/web/db_ui/login", originalUrl: "/web/db_ui/login",
      headers: { authorization: "Bearer test-token", cookie: "test-cookie" },
      body: { password: "test-password" }, ip: "127.0.0.1",
    } as unknown as Request;
    const response = Object.assign(new EventEmitter(), {
      locals: {}, statusCode: 200, get: () => "123", send: (_value: string) => undefined,
    });
    new LoggerMiddleware().use(request, response as unknown as Response, () => {});
    response.send('{"token":"test-issued-token"}');
    response.emit("finish");
    const output = JSON.stringify(debug.mock.calls);
    for (const secret of ["test-token", "test-cookie", "test-password", "test-issued-token"]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain("[redacted]");
    expect(request.headers.authorization).toBe("Bearer test-token");
  } finally { debug.mockRestore(); }
});
