import { createHash } from "node:crypto";

export type ClientOptions = {
  baseUrl?: "https://securepay.tinkoff.ru" | "https://rest-api-test.tinkoff.ru";
  terminalPassword: string;
};

// deno-lint-ignore no-explicit-any
export type Payload = Record<string, any>;

export class TBankApiError extends Error {
  constructor(
    public endpoint: string,
    message: string,
  ) {
    super(message);
  }
}

export class Client {
  readonly baseUrl: string;

  constructor(private options: ClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://securepay.tinkoff.ru";
  }

  async request<T, B extends Payload = Payload>(
    method: "GET" | "POST",
    endpoint: string,
    body?: B,
    sign = true,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      // oxlint-disable-next-line no-invalid-fetch-options
      body: body ? JSON.stringify(sign ? this.sign(body) : body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const data =
        res.body && !res.bodyUsed && res.headers.get("Content-Type")?.includes("application/json")
          ? await res.json()
          : ((await res.text()) ?? "");

      throw new TBankApiError(
        endpoint,
        `API request error: ${res.status}, ${JSON.stringify(data)}`,
      );
    }

    const data = await res.json();

    if (data.Success === false) {
      let message = "API endpoint error:";
      if (data.ErrorCode) {
        message += ` ${data.ErrorCode}`;
      }
      if (data.Message) {
        message += ` ${data.Message}`;
      }
      if (data.Details) {
        message += ` (${data.Details})`;
      }

      throw new TBankApiError(endpoint, message);
    }

    return data;
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>("GET", endpoint);
  }

  post<T, B extends object>(endpoint: string, body?: B, sign = true): Promise<T> {
    return this.request<T, B>("POST", endpoint, body, sign);
  }

  generateToken(payload: Payload): string {
    const params: Record<string, string | number | boolean> = {};

    Object.keys(payload).forEach((key) => {
      const value = payload[key];
      if (key === "Token") return;
      if (typeof value !== "object" && value !== undefined && value !== null) {
        params[key] = value;
      }
    });
    params["Password"] = this.options.terminalPassword;
    const sortedKeys = Object.keys(params).sort();
    const stringToSign = sortedKeys.map((key) => String(params[key])).join("");

    return createHash("sha256").update(stringToSign).digest("hex");
  }

  sign<T extends Payload>(payload: T): T {
    return {
      ...payload,
      Token: this.generateToken(payload),
    };
  }

  checkToken(payload: Payload): boolean {
    return this.generateToken(payload) === payload.Token;
  }
}
