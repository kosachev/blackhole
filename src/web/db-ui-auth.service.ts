import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { LRUCache } from "lru-cache";

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

  verify(authorization: string | undefined): void {
    const { hash, secret } = this.credentials();
    const match = authorization?.match(/^Bearer (v1\.[A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/);
    if (!match) throw new UnauthorizedException();
    const expected = this.signature(match[1], hash, secret);
    const actual = Buffer.from(match[2], "base64url");
    if (actual.toString("base64url") !== match[2] || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException();
    }
  }

  private signature(payload: string, hash: string, secret: string): Buffer {
    return createHmac("sha256", secret).update(`gerda-db-ui\n${hash}\n${payload}`).digest();
  }
}
