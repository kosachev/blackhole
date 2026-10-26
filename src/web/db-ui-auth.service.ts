import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { LRUCache } from "lru-cache";

export type DbUiScope = { admin: boolean; users: string[] | null };

const GUEST_PREFIX = "g1.";
const GUEST_DOMAIN = "gerda-db-ui-guest\n";
const GUEST_PAYLOAD_LIMIT = 8000;

@Injectable()
export class DbUiAuthService {
  private readonly attempts = new LRUCache<string, number>({ max: 1000, ttl: 60_000 });

  constructor(private readonly config: ConfigService) {}

  private credentials() {
    const hash = this.config.get<string>("DB_UI_PASSWORD_HASH");
    const secret = this.config.get<string>("DB_UI_TOKEN_SECRET");
    if (!hash || !secret || Buffer.byteLength(secret) < 32) {
      throw new ServiceUnavailableException("DB UI authentication is not configured");
    }
    return { hash, secret };
  }

  async login(password: unknown, ip: string): Promise<{ token: string }> {
    const { hash, secret } = this.credentials();
    const attempts = this.attempts.get(ip) ?? 0;
    if (attempts >= 5) {
      throw new HttpException("Too many login attempts", HttpStatus.TOO_MANY_REQUESTS);
    }
    this.attempts.set(ip, attempts + 1, { noUpdateTTL: true });
    if (typeof password !== "string" || password.length === 0 || password.length > 1024) {
      throw new UnauthorizedException();
    }
    let valid: boolean;
    try {
      valid = await Bun.password.verify(password, hash);
    } catch {
      throw new ServiceUnavailableException("Invalid DB UI password hash");
    }
    if (!valid) throw new UnauthorizedException();
    const payload = `v1.${randomBytes(32).toString("base64url")}`;
    return { token: `${payload}.${this.signature(payload, hash, secret).toString("base64url")}` };
  }

  issueGuest(manager: unknown, users: unknown, settings: unknown): string {
    const { secret } = this.credentials();
    if (typeof manager !== "string" || manager.trim() === "" || manager.length > 64) {
      throw new BadRequestException("Invalid guest manager");
    }
    const list = this.guestUsers(users, () => new BadRequestException("Invalid guest users"));
    const payload = Buffer.from(JSON.stringify({ m: manager.trim(), u: list, s: settings ?? null }), "utf8")
      .toString("base64url");
    if (payload.length > GUEST_PAYLOAD_LIMIT) throw new BadRequestException("Guest payload is too large");
    const signature = createHmac("sha256", secret).update(`${GUEST_DOMAIN}${payload}`).digest("base64url");
    return `${GUEST_PREFIX}${payload}.${signature}`;
  }

  verify(authorization: string | undefined): DbUiScope {
    const header = authorization ?? "";
    if (header.startsWith(`Bearer ${GUEST_PREFIX}`)) {
      return this.verifyGuest(header.slice(`Bearer ${GUEST_PREFIX}`.length));
    }
    const { hash, secret } = this.credentials();
    const match = header.match(/^Bearer (v1\.[A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/);
    if (!match) throw new UnauthorizedException();
    const expected = this.signature(match[1], hash, secret);
    const actual = Buffer.from(match[2], "base64url");
    if (actual.toString("base64url") !== match[2] || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException();
    }
    return { admin: true, users: null };
  }

  private verifyGuest(token: string): DbUiScope {
    const { secret } = this.credentials();
    const parts = token.split(".");
    if (parts.length !== 2) throw new UnauthorizedException();
    const [payload, signature] = parts;
    const expected = createHmac("sha256", secret).update(`${GUEST_DOMAIN}${payload}`).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.toString("base64url") !== signature || actual.length !== expected.length ||
      !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException();
    }
    let data: unknown;
    try {
      data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw new UnauthorizedException();
    }
    const users = this.guestUsers((data as { u?: unknown } | null)?.u, () => new UnauthorizedException());
    return { admin: false, users };
  }

  private guestUsers(value: unknown, fail: () => Error): string[] {
    if (!Array.isArray(value) || value.length === 0 || value.length > 20) throw fail();
    const users = value.map((item) => (typeof item === "string" ? item.trim() : ""));
    if (users.some((item) => item === "" || item.length > 64)) throw fail();
    return users;
  }

  private signature(payload: string, hash: string, secret: string): Buffer {
    return createHmac("sha256", secret).update(`gerda-db-ui\n${hash}\n${payload}`).digest();
  }
}
