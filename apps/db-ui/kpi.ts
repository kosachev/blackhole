import type { KpiRow } from "../../src/db/kpi.table";
import type { KpiReportRow } from "../../src/web/db-ui.service";

export type { KpiRow };
export type { KpiReportRow };
export type DedupeMode = "off" | "highlight" | "remove";
export type Settings = {
  managers: { id: string; alias: string; name: string }[];
  stages: { id: string; name: string; rate: number | null }[];
  dedupe?: DedupeMode;
};
export const DEFAULT_SETTINGS: Settings = {
  managers: [
    { id: "1092156", alias: "Admin", name: "GERDA" },
    { id: "1109421", alias: "Manager-1", name: "Олеся" },
    { id: "1110687", alias: "Manager-2", name: "Настя" },
    { id: "14171622", alias: "Manager-3", name: "Катя" },
  ],
  stages: [
    { id: "visit", name: "Визит", rate: 100 },
    { id: "payment", name: "Оплата", rate: 200 },
    { id: "delivery", name: "Доставка", rate: 100 },
  ],
  dedupe: "off",
};

export function validSettings(value: unknown): value is Settings {
  if (!value || typeof value !== "object") return false;
  const { managers, stages, dedupe } = value as Settings;
  if (!Array.isArray(managers) || !Array.isArray(stages)) return false;
  if (dedupe !== undefined && dedupe !== "off" && dedupe !== "highlight" && dedupe !== "remove") return false;
  if (!managers.every((m) => m && typeof m.id === "string" && m.id.trim() !== "" &&
    typeof m.alias === "string" && typeof m.name === "string" && m.name.trim() !== "")) return false;
  const keys = managers.flatMap((m) => m.alias && m.alias !== m.id ? [m.id, m.alias] : [m.id]);
  return new Set(keys).size === keys.length &&
    stages.every((s) => s && typeof s.id === "string" && s.id.trim() !== "" &&
      typeof s.name === "string" && s.name.trim() !== "" && (s.rate === null || (Number.isFinite(s.rate) &&
      s.rate >= 0 && Number.isSafeInteger(Math.round(s.rate * 100)) &&
      Math.abs(s.rate * 100 - Math.round(s.rate * 100)) < 0.000001))) &&
    new Set(stages.map((s) => s.id)).size === stages.length;
}

export function dedupeMode(settings: Settings): DedupeMode {
  return settings.dedupe ?? "off";
}

export function managerId(value: string, settings: Settings): string {
  return settings.managers.find((m) => m.id === value || m.alias === value)?.id ?? value;
}
export function managerName(value: string, settings: Settings): string {
  const manager = settings.managers.find((m) => m.id === value || m.alias === value);
  return manager ? `${manager.name} (${manager.id})` : value || "Не указан";
}
export function stageName(value: string, settings: Settings): string {
  return settings.stages.find((s) => s.id === value)?.name ?? (value || "Не указан");
}
export function rateKopecks(value: string, settings: Settings): number | null {
  const stage = settings.stages.find((s) => s.id === value);
  return stage?.rate == null ? null : Math.round(stage.rate * 100);
}

function midnight(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Укажите корректные даты.");
  const utc = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== date) {
    throw new Error("Укажите корректные даты.");
  }
  return utc / 1000 - 3 * 3600;
}
export function dateRange(from: string, to: string) {
  const start = midnight(from);
  const end = midnight(to) + 86400;
  if (start >= end) throw new Error("Дата начала должна быть не позже даты окончания.");
  return { start, end };
}
export function filterRows<T extends KpiRow>(rows: T[], from: string, to: string, manager: string, settings: Settings): T[] {
  const { start, end } = dateRange(from, to);
  return rows.filter((r) => r.kpiReachedAt !== null && r.kpiReachedAt >= start &&
    r.kpiReachedAt < end && (!manager || managerId(r.responsibleUser, settings) === managerId(manager, settings)));
}
export type DedupeResult = { rows: KpiReportRow[]; counted: KpiReportRow[]; duplicates: Set<number>; shadowed: number };

export function applyDedupe(rows: KpiReportRow[], mode: DedupeMode): DedupeResult {
  if (mode === "off") return { rows, counted: rows, duplicates: new Set(), shadowed: 0 };
  const counted = rows.filter((row) => row.latest);
  const duplicates = new Set(rows.filter((row) => row.duplicate).map((row) => row.id));
  return {
    rows: mode === "highlight" ? rows : counted,
    counted,
    duplicates,
    shadowed: rows.length - counted.length,
  };
}
export type SummaryRow = { manager: string; stage: string; count: number; amount: number; unrated: number };
export function summarize(rows: KpiRow[], settings: Settings): SummaryRow[] {
  const groups = new Map<string, SummaryRow>();
  for (const row of rows) {
    const manager = managerId(row.responsibleUser, settings);
    const key = JSON.stringify([manager, row.kpiType]);
    const group = groups.get(key) ?? { manager, stage: row.kpiType, count: 0, amount: 0, unrated: 0 };
    const amount = rateKopecks(row.kpiType, settings);
    group.count++;
    group.amount += amount ?? 0;
    if (amount === null) group.unrated++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => managerName(a.manager, settings).localeCompare(managerName(b.manager, settings), "ru") || a.stage.localeCompare(b.stage));
}
export function dateTime(timestamp: number | null): string {
  return timestamp === null ? "" : new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date(timestamp * 1000));
}
export function csv(rows: (string | number | null)[][]): string {
  return "\uFEFF" + rows.map((row) => row.map((cell) => {
    let value = cell === null ? "" : typeof cell === "number" ? String(cell).replace(".", ",") : cell;
    // Prevent spreadsheet formulas when opening text received from the database/settings.
    if (typeof cell === "string" && /^[\s]*[=+\-@]/.test(value)) value = "'" + value;
    return `"${value.replaceAll('"', '""')}"`;
  }).join(";")).join("\r\n");
}
export function detailCsv(rows: KpiRow[], settings: Settings): string {
  return csv([
    ["ID записи", "ID сделки", "ID ответственного", "Ответственный", "Изменил статус", "Код этапа", "Этап", "Сумма сделки, ₽", "KPI, ₽", "Создана (МСК)", "Время KPI (МСК)"],
    ...rows.map((r) => {
      const amount = rateKopecks(r.kpiType, settings);
      return [r.id, r.leadId, managerId(r.responsibleUser, settings), managerName(r.responsibleUser, settings),
        managerName(r.statusUser, settings), r.kpiType, stageName(r.kpiType, settings),
        r.price, amount === null ? null : amount / 100, dateTime(r.leadCreatedAt), dateTime(r.kpiReachedAt)];
    }),
  ]);
}
export function summaryCsv(rows: KpiRow[], settings: Settings): string {
  const summary = summarize(rows, settings);
  return csv([
    ["ID менеджера", "Менеджер", "Код этапа", "Этап", "Количество", "Сумма, ₽", "Без ставки"],
    ...summary.map((r) => [r.manager, managerName(r.manager, settings), r.stage, stageName(r.stage, settings), r.count, r.amount / 100, r.unrated]),
    ["", "Итого", "", "", rows.length, summary.reduce((sum, r) => sum + r.amount, 0) / 100, summary.reduce((sum, r) => sum + r.unrated, 0)],
  ]);
}
