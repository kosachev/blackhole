import { describe, expect, test } from "bun:test";
import { ConfigService } from "@nestjs/config";
import { DeliveryPriceService } from "../../src/web/delivery-price.service";

function service(max: string | undefined, dbDelta: number | undefined, sheetDelta: number | undefined) {
  return new DeliveryPriceService(
    {
      get: (key: string) => (key === "CDEK_MAX_PRICE_ADDITION" ? max : undefined),
    } as unknown as ConfigService,
    undefined as never,
    undefined as never,
    { cdekPrice: { getCdekDelta: () => dbDelta } } as never,
    { cdekPrice: { getCdekDelta: async () => sheetDelta } } as never,
  );
}

describe("DeliveryPriceService CDEK addition", () => {
  test("prefers database value over the sheet", async () => {
    const svc = service("400", -25.5, 100);
    await svc.fetchCdekPriceAddition();
    expect(svc.getCdekPriceAddition()).toBe(25.5);
  });

  test("falls back to the sheet when the database is empty", async () => {
    const svc = service("400", undefined, -10);
    await svc.fetchCdekPriceAddition();
    expect(svc.getCdekPriceAddition()).toBe(10);
  });

  test("caps the dynamic value with the configured max", async () => {
    const svc = service("400", -1000, undefined);
    await svc.fetchCdekPriceAddition();
    expect(svc.getCdekPriceAddition()).toBe(400);
  });

  test("never returns NaN when every source is empty", async () => {
    const svc = service("400", undefined, undefined);
    await svc.fetchCdekPriceAddition();
    expect(svc.getCdekPriceAddition()).toBe(400);
  });

  test("works without a configured max", async () => {
    const svc = service(undefined, -25.5, undefined);
    await svc.fetchCdekPriceAddition();
    expect(svc.getCdekPriceAddition()).toBe(25.5);
  });

  test("ignores a poisoned NaN dynamic value", () => {
    const svc = service("400", undefined, undefined);
    (svc as unknown as Record<string, unknown>)["cdekDymanicPriceAddition"] = Number.NaN;
    expect(svc.getCdekPriceAddition()).toBe(400);
  });
});
