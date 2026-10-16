import { describe, expect, test } from "bun:test";
import {
  validCdekDeltaResponse,
  defaultCdekRange,
  type CdekDeltaResponse,
} from "../../apps/db-ui/cdek";

const metrics = {
  dealsCount: 1,
  clientDelivery: 500,
  companyDelivery: 400,
  companyReturn: 50,
  companyTotal: 450,
  delta: 50,
  averageDelta: 50,
};

const response = (): CdekDeltaResponse => ({
  storedDelta: -25.5,
  maxAddition: 400,
  finalAddition: 25.5,
  calculation: {
    from: 1786741200,
    to: 1788987600,
    total: { ...metrics },
    months: [
      { ...metrics, key: "2026-08", label: "Август 2026", from: 1786741200, to: 1788209999 },
      { ...metrics, key: "2026-09", label: "Сентябрь 2026", from: 1788210000, to: 1788987600 },
    ],
  },
});

describe("CDEK delta response", () => {
  test("accepts stored delta and monthly calculation", () => {
    expect(validCdekDeltaResponse(response())).toBe(true);
    expect(validCdekDeltaResponse({ ...response(), storedDelta: null })).toBe(true);
    expect(validCdekDeltaResponse({ ...response(), maxAddition: null })).toBe(true);
  });

  test("rejects malformed payloads", () => {
    expect(validCdekDeltaResponse(null)).toBe(false);
    expect(validCdekDeltaResponse({ ...response(), storedDelta: "12" })).toBe(false);
    expect(validCdekDeltaResponse({ ...response(), storedDelta: Infinity })).toBe(false);
    expect(validCdekDeltaResponse({ ...response(), maxAddition: "400" })).toBe(false);
    expect(validCdekDeltaResponse({ ...response(), finalAddition: undefined })).toBe(false);
    expect(validCdekDeltaResponse({ storedDelta: 1 })).toBe(false);
    const noMonths = response();
    (noMonths.calculation as unknown as Record<string, unknown>)["months"] = {};
    expect(validCdekDeltaResponse(noMonths)).toBe(false);
    const badMonth = response();
    badMonth.calculation.months[0].averageDelta = Number.NaN;
    expect(validCdekDeltaResponse(badMonth)).toBe(false);
    const badKey = response();
    (badKey.calculation.months[0] as unknown as Record<string, unknown>)["key"] = 202608;
    expect(validCdekDeltaResponse(badKey)).toBe(false);
  });
});

describe("CDEK default range", () => {
  test("covers two closed months for an october date", () => {
    expect(defaultCdekRange(new Date("2026-10-16T12:00:00+03:00"))).toEqual({
      from: "2026-08-01",
      to: "2026-09-30",
    });
  });

  test("crosses year boundary for a january date", () => {
    expect(defaultCdekRange(new Date("2026-01-10T12:00:00+03:00"))).toEqual({
      from: "2025-11-01",
      to: "2025-12-31",
    });
  });
});
