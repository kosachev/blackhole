export type CdekDeltaMetrics = {
  dealsCount: number;
  clientDelivery: number;
  companyDelivery: number;
  companyReturn: number;
  companyTotal: number;
  delta: number;
  averageDelta: number;
};

export type CdekDeltaMonth = CdekDeltaMetrics & {
  key: string;
  label: string;
  from: number;
  to: number;
};

export type CdekDeltaResult = {
  from: number;
  to: number;
  total: CdekDeltaMetrics;
  months: CdekDeltaMonth[];
};

export type CdekDeltaResponse = {
  storedDelta: number | null;
  maxAddition: number | null;
  finalAddition: number;
  calculation: CdekDeltaResult;
};

const METRIC_KEYS = [
  "dealsCount",
  "clientDelivery",
  "companyDelivery",
  "companyReturn",
  "companyTotal",
  "delta",
  "averageDelta",
] as const;

function validMetrics(value: unknown): value is CdekDeltaMetrics {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return METRIC_KEYS.every(
    (key) => typeof record[key] === "number" && Number.isFinite(record[key]),
  );
}

function validMonth(value: unknown): value is CdekDeltaMonth {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    validMetrics(value) &&
    typeof record["key"] === "string" &&
    typeof record["label"] === "string" &&
    typeof record["from"] === "number" &&
    Number.isFinite(record["from"]) &&
    typeof record["to"] === "number" &&
    Number.isFinite(record["to"])
  );
}

export function validCdekDeltaResponse(value: unknown): value is CdekDeltaResponse {  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const { storedDelta, maxAddition, finalAddition, calculation } = record;
  if (storedDelta !== null && (typeof storedDelta !== "number" || !Number.isFinite(storedDelta))) {
    return false;
  }
  if (maxAddition !== null && (typeof maxAddition !== "number" || !Number.isFinite(maxAddition))) {
    return false;
  }
  if (typeof finalAddition !== "number" || !Number.isFinite(finalAddition)) {
    return false;
  }
  if (!calculation || typeof calculation !== "object") return false;
  const range = calculation as Record<string, unknown>;
  return (
    typeof range["from"] === "number" &&
    Number.isFinite(range["from"]) &&
    typeof range["to"] === "number" &&
    Number.isFinite(range["to"]) &&
    validMetrics(range["total"]) &&
    Array.isArray(range["months"]) &&
    range["months"].every(validMonth)
  );
}

export function defaultCdekRange(now: Date = new Date()): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const first = shiftMonth(year, month, -2);
  const last = shiftMonth(year, month, -1);
  return {
    from: formatDay(first.year, first.month, 1),
    to: formatDay(last.year, last.month, lastDay(last.year, last.month)),
  };
}

function shiftMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + offset;
  return {
    year: Math.floor(zeroBased / 12),
    month: ((zeroBased % 12) + 12) % 12 + 1,
  };
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDay(year: number, month: number, day: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}
