import { describe, expect, test } from "bun:test";
import { CdekDeltaService, type CdekDeltaRow } from "../../src/cdek/cdek-delta.service";

const MSK = 3 * 3600;
const ts = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d) / 1000 - MSK;

function row(overrides: Partial<CdekDeltaRow> & { leadId: string }): CdekDeltaRow {
  return {
    shippingDate: ts(2026, 8, 20),
    deliveryType: "СДЭК",
    closedByRegister: "реестр",
    customerDeliveryPrice: 500,
    ownerDeliveryPrice: 400,
    ownerReturnDeliveryPrice: 0,
    ...overrides,
  };
}

describe("CdekDeltaService.calculate", () => {
  test("collapses goods rows by max prices and skips non-cdek or open deals", () => {
    const from = ts(2026, 8, 1);
    const to = ts(2026, 8, 31);

    const result = CdekDeltaService.calculate(
      [
        row({ leadId: "1", customerDeliveryPrice: 500 }),
        row({ leadId: "1", customerDeliveryPrice: 300, ownerReturnDeliveryPrice: 50 }),
        row({ leadId: "2", deliveryType: "Почта России" }),
        row({ leadId: "3", closedByRegister: "" }),
        row({ leadId: "4", shippingDate: ts(2026, 7, 20) }),
      ],
      from,
      to,
    );

    expect(result.total.dealsCount).toBe(1);
    expect(result.total.clientDelivery).toBe(500);
    expect(result.total.companyReturn).toBe(50);
    expect(result.total.companyTotal).toBe(450);
    expect(result.total.delta).toBe(50);
    expect(result.total.averageDelta).toBe(50);
  });

  test("anchors deal to earliest shipping date", () => {
    const from = ts(2026, 8, 1);
    const to = ts(2026, 8, 31);

    const result = CdekDeltaService.calculate(
      [
        row({ leadId: "1", shippingDate: ts(2026, 8, 10) }),
        row({ leadId: "1", shippingDate: ts(2026, 7, 5) }),
      ],
      from,
      to,
    );

    expect(result.total.dealsCount).toBe(0);
    expect(result.months).toHaveLength(1);
    expect(result.months[0]?.dealsCount).toBe(0);
  });

  test("splits range into months with clipped edges and zero-filled gaps", () => {
    const from = ts(2026, 8, 15);
    const to = ts(2026, 10, 10);

    const result = CdekDeltaService.calculate(
      [row({ leadId: "1", shippingDate: ts(2026, 10, 5), customerDeliveryPrice: 600 })],
      from,
      to,
    );

    expect(result.months.map((month) => month.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(result.months[0]).toMatchObject({ from, dealsCount: 0, delta: 0 });
    expect(result.months[1]?.dealsCount).toBe(0);
    expect(result.months[2]).toMatchObject({ to, dealsCount: 1, delta: 200 });
    expect(result.total).toMatchObject({ dealsCount: 1, delta: 200, averageDelta: 200 });
  });

  test("rounds money values to two decimals", () => {
    const from = ts(2026, 8, 1);
    const to = ts(2026, 8, 31);

    const result = CdekDeltaService.calculate(
      [
        row({ leadId: "1", customerDeliveryPrice: 0.1, ownerDeliveryPrice: 0 }),
        row({ leadId: "2", customerDeliveryPrice: 0.2, ownerDeliveryPrice: 0 }),
        row({ leadId: "3", customerDeliveryPrice: 10, ownerDeliveryPrice: 0 }),
      ],
      from,
      to,
    );

    expect(result.total.clientDelivery).toBe(10.3);
    expect(result.total.delta).toBe(10.3);
    expect(result.total.averageDelta).toBe(3.43);
  });

  test("throws on inverted interval", () => {
    expect(() => CdekDeltaService.calculate([], ts(2026, 9, 1), ts(2026, 8, 1))).toThrow();
  });

  test("takes two fully closed months for an october date", () => {
    const range = CdekDeltaService.twoClosedMonthsRange(ts(2026, 10, 16));

    expect(range.from).toBe(ts(2026, 8, 1));
    expect(range.to).toBe(Date.UTC(2026, 9, 1) / 1000 - MSK - 1);
  });

  test("takes january and february for a march date", () => {
    const range = CdekDeltaService.twoClosedMonthsRange(ts(2026, 3, 5));

    expect(range.from).toBe(ts(2026, 1, 1));
    expect(range.to).toBe(Date.UTC(2026, 2, 1) / 1000 - MSK - 1);
  });

  test("crosses year boundary for a january date", () => {
    const range = CdekDeltaService.twoClosedMonthsRange(ts(2026, 1, 10));

    expect(range.from).toBe(ts(2025, 11, 1));
    expect(range.to).toBe(Date.UTC(2026, 0, 1) / 1000 - MSK - 1);
  });

  test("converts calendar days to an inclusive moscow interval", () => {
    expect(CdekDeltaService.dayRange("2026-08-01", "2026-08-31")).toEqual({
      from: ts(2026, 8, 1),
      to: ts(2026, 8, 31) + 86400 - 1,
    });
    expect(() => CdekDeltaService.dayRange("2026-02-30", "2026-03-01")).toThrow();
    expect(() => CdekDeltaService.dayRange("2026-09-01", "2026-08-01")).toThrow();
    expect(() => CdekDeltaService.dayRange("", "2026-08-01")).toThrow();
  });
});
