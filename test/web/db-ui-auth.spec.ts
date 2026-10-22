import { describe, expect, test } from "bun:test";
import { ConfigService } from "@nestjs/config";
import { DbUiAuthService } from "../../src/web/db-ui-auth.service";

const password = "test-only-password";
const hash = await Bun.password.hash(password);
const secret = "test-only-signing-secret-with-32-bytes";
const auth = (values = {}) => new DbUiAuthService(new ConfigService({
  DB_UI_PASSWORD_HASH: hash, DB_UI_TOKEN_SECRET: secret, ...values,
}));

describe("DB UI authentication", () => {
  test("checks the password through Bun and issues tokens that survive a restart", async () => {
    const service = auth();
    const first = await service.login(password, "test-ip");
    const second = await service.login(password, "test-ip");
    expect(first.token).not.toBe(second.token);
    expect(() => auth().verify(`Bearer ${first.token}`)).not.toThrow();
    expect(first.token).not.toContain(password);
    expect(first.token).not.toContain(hash);
  });
  test("rejects wrong passwords, missing tokens and modified tokens", async () => {
    const service = auth();
    await expect(service.login("wrong", "test-ip")).rejects.toThrow();
    for (const value of [null, {}, "", "x".repeat(1025)]) {
      await expect(auth().login(value, "test-ip")).rejects.toThrow();
    }
    const { token } = await service.login(password, "test-ip");
    for (const value of [undefined, "", token, `Bearer ${token}.extra`, `Bearer v1.${"a".repeat(43)}.${"b".repeat(43)}`]) {
      expect(() => service.verify(value)).toThrow();
    }
  });
  test("rotation invalidates existing tokens and missing config never grants access", async () => {
    const { token } = await auth().login(password, "test-ip");
    for (const config of [
      { DB_UI_TOKEN_SECRET: "other-test-only-signing-secret-32bytes" },
      { DB_UI_PASSWORD_HASH: await Bun.password.hash(password) },
      { DB_UI_PASSWORD_HASH: "" },
      { DB_UI_TOKEN_SECRET: "" },
    ]) expect(() => auth(config).verify(`Bearer ${token}`)).toThrow();
    await expect(auth({ DB_UI_PASSWORD_HASH: "bad-hash" }).login(password, "test-ip")).rejects.toThrow();
  });
  test("limits attempts per IP before running another password check", async () => {
    const service = auth();
    for (let i = 0; i < 5; i++) await expect(service.login("wrong", "test-ip")).rejects.toThrow();
    try {
      await service.login(password, "test-ip");
      throw new Error("Expected throttling");
    } catch (error) {
      expect((error as { getStatus(): number }).getStatus()).toBe(429);
    }
    expect((await service.login(password, "other-ip")).token).toBeString();
  });
  test("issues guest links that only grant access to the listed users", () => {
    const service = auth();
    const token = service.issueGuest("1109421", ["1109421", "Manager-1"], { managers: [], stages: [] });
    expect(token).toStartWith("g1.");
    expect(service.verify(`Bearer ${token}`)).toEqual({ admin: false, users: ["1109421", "Manager-1"] });
  });
  test("rejects forged, empty and oversized guest links", () => {
    const service = auth();
    const token = service.issueGuest("1109421", ["1109421"], null);
    const [prefix, payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ m: "1092156", u: ["1092156"], s: null }), "utf8").toString("base64url");
    expect(() => service.verify(`Bearer ${prefix}.${forged}.${signature}`)).toThrow();
    expect(() => service.verify(`Bearer ${prefix}.${payload}.${signature}x`)).toThrow();
    expect(() => service.verify(`Bearer ${prefix}.${payload}`)).toThrow();
    expect(() => service.issueGuest("", ["1109421"], null)).toThrow();
    expect(() => service.issueGuest("1109421", [], null)).toThrow();
    expect(() => service.issueGuest("1109421", ["1109421"], { big: "x".repeat(9000) })).toThrow();
  });
  test("rotating the signing secret invalidates guest links", () => {
    const token = auth().issueGuest("1109421", ["1109421"], null);
    expect(() => auth({ DB_UI_TOKEN_SECRET: "other-test-only-signing-secret-32bytes" })
      .verify(`Bearer ${token}`)).toThrow();
  });
});
