import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SETTINGS, dateRange, filterRows, summarize, detailCsv, summaryCsv,
  csv, validSettings, applyDedupe, dedupeMode, type KpiRow, type KpiReportRow,
} from "../../apps/db-ui/kpi";

const settings = structuredClone(DEFAULT_SETTINGS);
const start = Date.parse("2026-09-28T00:00:00+03:00") / 1000;
const entry = (overrides: Partial<KpiRow> = {}): KpiRow => ({
  id: 1, kpiReachedAt: start, leadCreatedAt: start - 100,
  leadId: "42", responsibleUser: "Manager-2", statusUser: "Manager-1",
  kpiType: "visit", price: 50000, ...overrides,
});
const report = (overrides: Partial<KpiReportRow> = {}): KpiReportRow => ({
  ...entry(), latest: true, duplicate: false, ...overrides,
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
  test("keeps settings without a dedupe mode valid and defaults it to off", () => {
    const { dedupe, ...withoutDedupe } = settings;
    expect(dedupeMode(settings)).toBe("off");
    expect(validSettings(withoutDedupe)).toBe(true);
    expect(dedupeMode(withoutDedupe)).toBe("off");
    expect(validSettings({ ...settings, dedupe: "broken" })).toBe(false);
    expect(validSettings({ ...settings, dedupe: "highlight" })).toBe(true);
  });
  test("counts only the latest KPI record of every deal and marks duplicates", () => {
    const rows = [
      report({ id: 1, leadId: "42", kpiReachedAt: start + 300, kpiType: "payment", latest: true, duplicate: true }),
      report({ id: 2, leadId: "42", kpiReachedAt: start + 200, kpiType: "visit", latest: false, duplicate: true }),
      report({ id: 3, leadId: "42", kpiReachedAt: start + 100, kpiType: "visit", latest: false, duplicate: true }),
      report({ id: 4, leadId: "43", kpiReachedAt: start + 50, kpiType: "delivery", latest: true, duplicate: false }),
    ];
    const off = applyDedupe(rows, "off");
    expect(off.rows).toHaveLength(4);
    expect(off.counted).toHaveLength(4);
    expect(off.shadowed).toBe(0);
    expect(off.duplicates.size).toBe(0);

    const highlight = applyDedupe(rows, "highlight");
    expect(highlight.rows).toHaveLength(4);
    expect(highlight.counted.map((r) => r.id)).toEqual([1, 4]);
    expect(highlight.shadowed).toBe(2);
    expect([...highlight.duplicates].sort()).toEqual([1, 2, 3]);
    expect(summarize(highlight.counted, settings).reduce((sum, g) => sum + g.amount, 0)).toBe(30000);

    const remove = applyDedupe(rows, "remove");
    expect(remove.rows.map((r) => r.id)).toEqual([1, 4]);
    expect(remove.counted.map((r) => r.id)).toEqual([1, 4]);
    expect(remove.shadowed).toBe(2);
    expect(remove.duplicates.size).toBe(3);
    expect(summarize(remove.counted, settings).reduce((sum, g) => sum + g.amount, 0)).toBe(30000);
    expect(summarize(highlight.counted, settings)).toEqual(summarize(remove.counted, settings));
  });
  test("keeps records of other managers out of the counted rows", () => {
    const rows = [
      report({ id: 1, leadId: "42", responsibleUser: "Manager-1", latest: false, duplicate: true }),
      report({ id: 2, leadId: "42", responsibleUser: "Manager-1", latest: false, duplicate: true }),
      report({ id: 3, leadId: "42", responsibleUser: "Manager-2", latest: true, duplicate: true }),
    ];
    const counted = applyDedupe(rows, "remove").counted;
    expect(counted.map((r) => r.id)).toEqual([3]);
    expect(summarize(counted, settings).reduce((sum, g) => sum + g.amount, 0)).toBe(10000);
  });
});
