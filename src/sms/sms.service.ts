import { createHash } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LRUCache } from "lru-cache";

const API_URL = "https://cp.redsms.ru/api";

export const SMS_STATUS_DESCRIPTION = {
  created: "сообщение создано и ожидает отправки",
  moderation: "сообщение проверяется модераторами",
  reject: "сообщение отклонено модератором",
  delivered: "сообщение доставлено",
  undelivered: "сообщение не доставлено",
  timeout: "истекло время ожидания статуса сообщения",
  progress: "сообщение в процессе отправки",
  no_money: "недостаточно средств для отправки сообщения",
  doubled: "дублирование сообщения",
  limit_exceeded: "исчерпан один из лимитов на отправку сообщений",
  bad_number: "некорректный номер телефона получателя",
  stop_list: "номер телефона получателя находится в стоп-листе",
  route_closed: "направление закрыто для отправки",
  error: "неизвестная ошибка отправки",
} as const;

const PENDING_STATUS = ["created", "moderation", "progress"];

const HTTP_ERROR = {
  400: "REDSMS отклонил запрос, проверьте номер, отправителя и ограничения",
  401: "REDSMS: проверьте логин, API-ключ и белый список IP",
  404: "REDSMS: некорректный URL запроса",
  420: "REDSMS: недостаточно средств",
  500: "REDSMS: непредвиденная ошибка сервера",
} as const;

export type SmsData = {
  leadId: number;
  uuid: string;
  ts: number;
};

export function normalizePhone(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!/^[+\d\s().-]+$/.test(value)) return "";
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "8") digits = "7" + digits.slice(1);
  else if (digits.length === 10 && !value.startsWith("+")) digits = "7" + digits;
  return /^[1-9]\d{9,14}$/.test(digits) ? "+" + digits : "";
}

@Injectable()
export class SmsService {
  protected readonly logger: Logger = new Logger(SmsService.name);
  private readonly login: string;
  private readonly apiKey: string;
  private readonly from: string;

  private readonly uuidToLeadMap: LRUCache<string, SmsData>;

  constructor(private readonly config: ConfigService) {
    this.login = this.config.get<string>("REDSMS_LOGIN");
    this.apiKey = this.config.get<string>("REDSMS_API_KEY");
    this.from = this.config.get<string>("REDSMS_FROM");

    this.uuidToLeadMap = new LRUCache<string, SmsData>({
      max: 100,
    });
  }

  getSmsToLead(uuid: string): SmsData | undefined {
    return this.uuidToLeadMap.get(uuid);
  }

  setSmsToLead(sms: SmsData) {
    this.uuidToLeadMap.set(sms.uuid, sms);
  }

  deleteSmsToLead(uuid: string) {
    this.uuidToLeadMap.delete(uuid);
  }

  isPendingStatus(status: string): boolean {
    return PENDING_STATUS.includes(status);
  }

  describeStatus(status: string): string {
    return SMS_STATUS_DESCRIPTION[status as keyof typeof SMS_STATUS_DESCRIPTION] ?? "неизвестный статус";
  }

  async send(leadId: number, to: string, text: string): Promise<string> {
    if (!this.login || !this.apiKey || !this.from) {
      throw new Error("REDSMS: не заданы REDSMS_LOGIN, REDSMS_API_KEY или REDSMS_FROM");
    }

    const ts = `ts-value-${Date.now()}`;

    let res: Response;
    try {
      res = await fetch(`${API_URL}/message?fields=uuid,status,to`, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          login: this.login,
          ts,
          secret: createHash("md5").update(ts + this.apiKey).digest("hex"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ route: "sms", from: this.from, to, text }),
      });
    } catch (error) {
      throw new Error(`REDSMS: нет ответа от сервиса, ${error.message}`);
    }

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(HTTP_ERROR[res.status as keyof typeof HTTP_ERROR] ?? `REDSMS отклонил запрос (HTTP ${res.status})`);
    }

    if (!body || body.success !== true) {
      const message = body?.errors?.[0]?.message ?? body?.error_message;
      throw new Error(message ? `REDSMS: ${message}` : "REDSMS: неоднозначный ответ сервиса");
    }

    const item = Array.isArray(body.items) ? body.items[0] : null;
    if (!item?.uuid) {
      throw new Error("REDSMS: сервис не вернул uuid сообщения");
    }

    this.setSmsToLead({ leadId, uuid: item.uuid, ts: Date.now() });

    this.logger.log(
      `USERSCRIPT_SMS, lead_id: ${leadId}, uuid: ${item.uuid}, to: ${to}, status: ${item.status}`,
    );

    return item.uuid;
  }
}
