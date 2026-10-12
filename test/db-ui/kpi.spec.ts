import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SETTINGS, dateRange, filterRows, summarize, detailCsv, summaryCsv,
  csv, validSettings, type KpiRow,
} from "../../apps/db-ui/kpi";

const settings = structuredClone(DEFAULT_SETTINGS);
const start = Date.parse("2026-09-28T00:00:00+03:00") / 1000;
const entry = (overrides: Partial<KpiRow> = {}): KpiRow => ({
  id: 1, kpiReachedAt: start, leadCreatedAt: start - 100,
  leadId: "42", responsibleUser: "Manager-2", statusUser: "Manager-1",
  kpiType: "visit", price: 50000, ...overrides,
});

describe("KPI report", () => {
  test("includes both Moscow dates and excludes null dates and next midnight", () => {
    const rows = [entry({ kpiReachedAt: start - 1 }), entry(),
      entry({ kpiReachedAt: start + 86400 - 1 }), entry({ kpiReachedAt: start + 86400 }), entry({ kpiReachedAt: null })];
    expect(filterRows(rows, "2026-09-28", "2026-09-28", "", settings)).toHaveLength(2);
    expect(dateRange("2026-09-28", "2026-09-29")).toEqual({ start, end: start + 2 * 86400 });
    expect(() => dateRange("2026-02-30", "2026-03-01")).toThrow();
    expect(() => dateRange("2026-09-29", "2026-09-28")).toThrow();
  });
  test("filters responsible user by ID or legacy alias, not the status user", () => {
    const rows = [entry(), entry({ id: 2, responsibleUser: "1110687" }),
      entry({ id: 3, responsibleUser: "Manager-1", statusUser: "Manager-2" })];
    for (const manager of ["1110687", "Manager-2"]) {
      expect(filterRows(rows, "2026-09-28", "2026-09-28", manager, settings).map((r) => r.id)).toEqual([1, 2]);
    }
  });
  test("uses stage rates, keeps repeated entries and unifies alias and ID", () => {
    const rows = [entry(), entry(), entry({ responsibleUser: "1110687", kpiType: "payment" }), entry({ kpiType: "delivery" })];
    const groups = summarize(rows, settings);
    expect(groups.reduce((sum, g) => sum + g.amount, 0)).toBe(50000);
    expect(groups.every((g) => g.manager === "1110687")).toBe(true);
    expect(groups.find((g) => g.stage === "visit")?.count).toBe(2);
    const changed = structuredClone(settings);
    changed.stages[0].rate = 100.25;
    expect(summarize([entry(), entry()], changed)[0].amount).toBe(20050);
    expect(summarize([entry({ kpiType: "other" })], settings)[0]).toMatchObject({ amount: 0, unrated: 1 });
  });
  test("CSV includes all rows, names, dates and calculated rates, safely quotes text", () => {
    const rows = Array.from({ length: 75 }, (_, index) => entry({ id: index + 1 }));
    const output = detailCsv(rows, settings);
    expect(csv([[100.25]])).toBe('\uFEFF"100,25"');
    expect(output.startsWith("\uFEFF")).toBe(true);
    expect(output.split("\r\n")).toHaveLength(76);
    expect(output).toContain("Настя (1110687)");
    expect(output).toContain('"50000";"100"');
    expect(output).toContain("28.09.2026");
    expect(summaryCsv(rows, settings)).toContain('"75";"7500"');
    expect(csv([['=1+2', 'a;"b\nc']])).toBe('\uFEFF"\'=1+2";"a;""b\nc"');
  });
  test("rejects corrupt settings, ambiguous manager mappings and invalid rates", () => {
    expect(validSettings(settings)).toBe(true);
    expect(validSettings(null)).toBe(false);
    expect(validSettings({ ...settings, stages: [{ id: "unknown", name: "Без ставки", rate: null }] })).toBe(true);
    expect(validSettings({ managers: [null], stages: [] })).toBe(false);
    for (const rate of [-1, Infinity, 0.001]) {
      expect(validSettings({ ...settings, stages: [{ id: "visit", name: "Визит", rate }] })).toBe(false);
    }
    expect(validSettings({ ...settings, managers: [...settings.managers, settings.managers[0]] })).toBe(false);
  });
});
