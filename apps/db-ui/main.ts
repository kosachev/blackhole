import {
  DEFAULT_SETTINGS, validSettings, managerId, managerName, stageName, rateKopecks,
  filterRows, summarize, dateTime, detailCsv, summaryCsv,
  type Settings, type KpiRow,
} from "./kpi";
import { validCdekDeltaResponse, defaultCdekRange, type CdekDeltaResponse } from "./cdek";

const STORAGE_KEY = "gerda.db-ui.settings.v1";
const TOKEN_KEY = "gerda.db-ui.token.v1";
let token = "";
let session = 0;
try { token = localStorage.getItem(TOKEN_KEY) ?? ""; } catch {}
const PAGE_SIZE = 50;
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const money = (amount: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(amount);
let settings: Settings = structuredClone(DEFAULT_SETTINGS);
let rows: KpiRow[] = [];
let filtered: KpiRow[] = [];
let page = 0;
let loaded = false;
let filters = { from: "", to: "", manager: "" };
let cdekLoaded = false;
let cdekLoading = false;

function error(message = "") {
  element("error").textContent = message;
  element("error").hidden = !message;
}
function cdekError(message = "") {
  element("cdek-error").textContent = message;
  element("cdek-error").hidden = !message;
}
function showTab(name: "kpi" | "cdek") {
  element("tab-kpi").hidden = name !== "kpi";
  element("tab-cdek").hidden = name !== "cdek";
  element<HTMLButtonElement>("tab-kpi-btn").className = name === "kpi" ? "" : "secondary";
  element<HTMLButtonElement>("tab-cdek-btn").className = name === "cdek" ? "" : "secondary";
  if (name === "cdek" && !cdekLoaded && !cdekLoading) {
    const range = defaultCdekRange();
    input("cdek-from").value = range.from;
    input("cdek-to").value = range.to;
    void loadCdek();
  }
}
function showCdek(data: CdekDeltaResponse) {
  element("cdek-report").hidden = false;
  element("cdek-stored").textContent = data.storedDelta === null ? "Не рассчитана" : `${money(data.storedDelta)} ₽`;
  element("cdek-max").textContent = data.maxAddition === null ? "Не задан" : `${money(data.maxAddition)} ₽`;
  element("cdek-final").textContent = `${money(data.finalAddition)} ₽`;
  const { calculation } = data;
  element("cdek-period").textContent =
    `${calculation.months.map((month) => month.label).join(" — ")} · Сделок: ${calculation.total.dealsCount}`;
  element("cdek-total").textContent = `${money(calculation.total.averageDelta)} ₽`;
  const body = element<HTMLTableSectionElement>("cdek-months-body");
  body.replaceChildren();
  if (!calculation.months.length) emptyRow(body, 8);
  for (const month of calculation.months) {
    const tr = body.insertRow();
    cell(tr, month.label);
    cell(tr, month.dealsCount, true);
    cell(tr, money(month.clientDelivery), true);
    cell(tr, money(month.companyDelivery), true);
    cell(tr, money(month.companyReturn), true);
    cell(tr, money(month.companyTotal), true);
    cell(tr, money(month.delta), true);
    cell(tr, money(month.averageDelta), true);
  }
  const total = calculation.total;
  const subtotal = body.insertRow();
  subtotal.className = "subtotal";
  cell(subtotal, "Итого");
  cell(subtotal, total.dealsCount, true);
  cell(subtotal, money(total.clientDelivery), true);
  cell(subtotal, money(total.companyDelivery), true);
  cell(subtotal, money(total.companyReturn), true);
  cell(subtotal, money(total.companyTotal), true);
  cell(subtotal, money(total.delta), true);
  cell(subtotal, money(total.averageDelta), true);
}
async function loadCdek() {
  if (!token || cdekLoading) return;
  const currentSession = session;
  const from = input("cdek-from").value;
  const to = input("cdek-to").value;
  if (!from || !to) {
    cdekError("Укажите обе даты.");
    return;
  }
  if (from > to) {
    cdekError("Дата начала должна быть не позже даты окончания.");
    return;
  }
  cdekLoading = true;
  cdekError();
  element("cdek-status").textContent = "Расчёт дельты…";
  try {
    const response = await fetch(`/web/db_ui/cdek-delta?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    if (currentSession !== session) return;
    if (response.status === 401) { logout("Сессия недействительна. Войдите снова."); return; }
    if (!response.ok) throw new Error(`Не удалось загрузить данные (HTTP ${response.status}).`);
    const data: unknown = await response.json();
    if (!validCdekDeltaResponse(data)) throw new Error("Сервер вернул данные в неожиданном формате.");
    if (currentSession !== session) return;
    cdekLoaded = true;
    showCdek(data);
    element("cdek-status").textContent = `Рассчитано ${dateTime(Math.floor(Date.now() / 1000))} МСК`;
  } catch (err) {
    if (currentSession !== session) return;
    cdekError(err instanceof Error ? err.message : "Ошибка загрузки данных.");
    element("cdek-status").textContent = cdekLoaded ? "Не удалось обновить данные. Показан предыдущий расчёт." : "Данные не загружены. Повторите попытку.";
  } finally {
    cdekLoading = false;
  }
}
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed: unknown = JSON.parse(saved);
    if (!validSettings(parsed)) throw new Error("Invalid settings");
    settings = parsed;
  }
} catch {
  element("settings-status").textContent = "Не удалось прочитать настройки браузера. Используются исходные значения.";
}

const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
input("from").value = today;
input("to").value = today;
filters = { from: today, to: today, manager: "" };

function cell(row: HTMLTableRowElement, value: string | number, numeric = false) {
  const td = row.insertCell();
  td.textContent = String(value);
  if (numeric) td.className = "number";
  return td;
}
function emptyRow(body: HTMLTableSectionElement, columns: number) {
  const td = body.insertRow().insertCell();
  td.colSpan = columns;
  td.textContent = "За выбранный период записей нет.";
}
function showReport() {
  filtered = filterRows(rows, filters.from, filters.to, filters.manager, settings);
  const groups = summarize(filtered, settings);
  element("report").hidden = false;
  element("report-period").textContent = `${filters.from} — ${filters.to} · ${filters.manager ? managerName(filters.manager, settings) : "Все менеджеры"}`;
  element("total").textContent = `${money(groups.reduce((sum, g) => sum + g.amount, 0) / 100)} ₽`;
  const missing = groups.reduce((sum, g) => sum + g.unrated, 0);
  const undated = rows.filter((r) => r.kpiReachedAt === null).length;
  element("warning").textContent = [
    missing ? `Без ставки: ${missing}. Эти записи не включены в сумму; задайте ставки в настройках.` : "",
    undated ? `В базе есть записи без даты KPI: ${undated}. В отчет по периоду они не входят.` : "",
  ].filter(Boolean).join(" ");
  const body = element<HTMLTableSectionElement>("summary-body");
  body.replaceChildren();
  if (!groups.length) emptyRow(body, 4);
  for (let index = 0; index < groups.length; index++) {
    const group = groups[index];
    const tr = body.insertRow();
    cell(tr, managerName(group.manager, settings));
    cell(tr, stageName(group.stage, settings));
    cell(tr, group.count, true);
    cell(tr, group.unrated ? "Без ставки" : money(group.amount / 100), true);
    if (groups[index + 1]?.manager !== group.manager) {
      const total = groups.filter((g) => g.manager === group.manager).reduce((sum, g) => sum + g.amount, 0);
      const subtotal = body.insertRow();
      subtotal.className = "subtotal";
      cell(subtotal, `${managerName(group.manager, settings)} — итого`).colSpan = 3;
      cell(subtotal, money(total / 100), true);
    }
  }
  showDetails();
}
function showDetails() {
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(Math.max(page, 0), pages - 1);
  const body = element<HTMLTableSectionElement>("detail-body");
  body.replaceChildren();
  if (!filtered.length) emptyRow(body, 9);
  for (const r of filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
    const tr = body.insertRow();
    cell(tr, r.id);
    const lead = cell(tr, r.leadId || "—");
    if (/^\d+$/.test(r.leadId)) {
      const link = document.createElement("a");
      link.href = `https://gerda.amocrm.ru/leads/detail/${r.leadId}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = r.leadId;
      lead.replaceChildren(link);
    }
    cell(tr, managerName(r.responsibleUser, settings));
    cell(tr, managerName(r.statusUser, settings));
    cell(tr, stageName(r.kpiType, settings));
    cell(tr, r.price === null ? "—" : money(r.price), true);
    const rate = rateKopecks(r.kpiType, settings);
    cell(tr, rate === null ? "Без ставки" : money(rate / 100), true);
    cell(tr, dateTime(r.leadCreatedAt) || "—");
    cell(tr, dateTime(r.kpiReachedAt) || "—");
  }
  element("page").textContent = `Страница ${page + 1} из ${pages} · Записей: ${filtered.length}`;
  element<HTMLButtonElement>("previous").disabled = page === 0;
  element<HTMLButtonElement>("next").disabled = page + 1 >= pages;
}
function editInput(tr: HTMLTableRowElement, value: string, label: string, type = "text") {
  const field = document.createElement("input");
  field.type = type;
  field.value = value;
  field.setAttribute("aria-label", label);
  field.required = true;
  tr.insertCell().append(field);
  return field;
}
function showSettings() {
  const managers = element<HTMLTableSectionElement>("manager-settings");
  const stages = element<HTMLTableSectionElement>("stage-settings");
  managers.replaceChildren();
  stages.replaceChildren();
  const knownManagers = settings.managers.map((m) => ({ ...m }));
  for (const value of new Set(rows.flatMap((r) => [r.responsibleUser, r.statusUser]).filter(Boolean))) {
    if (!knownManagers.some((m) => m.id === value || m.alias === value)) {
      knownManagers.push({ id: value, alias: "", name: value });
    }
  }
  for (const manager of knownManagers) {
    const tr = managers.insertRow();
    const id = editInput(tr, manager.id, "ID менеджера");
    id.readOnly = true;
    const alias = editInput(tr, manager.alias, "Обозначение в базе");
    alias.readOnly = true;
    alias.required = false;
    editInput(tr, manager.name, `Имя менеджера ${manager.id}`);
  }
  const knownStages: { id: string; name: string; rate: number | null }[] = settings.stages.map((s) => ({ ...s }));
  for (const value of new Set(rows.map((r) => r.kpiType).filter(Boolean))) {
    if (!knownStages.some((s) => s.id === value)) knownStages.push({ id: value, name: value, rate: null });
  }
  for (const stage of knownStages) {
    const tr = stages.insertRow();
    editInput(tr, stage.id, "Код этапа").readOnly = true;
    editInput(tr, stage.name, `Название этапа ${stage.id}`);
    const rate = editInput(tr, stage.rate === null ? "" : String(stage.rate), `Ставка ${stage.id}`, "number");
    rate.min = "0";
    rate.step = "0.01";
    rate.required = false;
    rate.placeholder = "Без ставки";
  }
  const list = element<HTMLDataListElement>("managers");
  list.replaceChildren();
  for (const m of knownManagers) {
    const option = document.createElement("option");
    option.value = m.id;
    option.label = m.name;
    list.append(option);
  }
}
function saveSettings(next: Settings) {
  if (!validSettings(next)) {
    element("settings-status").textContent = "Проверьте имена и ставки: сумма должна быть неотрицательной, с точностью до копеек.";
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    element("settings-status").textContent = "Браузер не разрешил сохранить настройки. Изменения не применены.";
    return;
  }
  settings = next;
  element("settings-status").textContent = "Настройки сохранены в этом браузере. Отчет пересчитан.";
  showSettings();
  if (loaded) showReport();
}
element("settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const managers = [...element<HTMLTableSectionElement>("manager-settings").rows].map((tr) => {
    const fields = tr.querySelectorAll("input");
    return { id: fields[0].value, alias: fields[1].value, name: fields[2].value.trim() };
  });
  const stages = [...element<HTMLTableSectionElement>("stage-settings").rows].map((tr) => {
    const fields = tr.querySelectorAll("input");
    return { id: fields[0].value, name: fields[1].value.trim(), rate: fields[2].value === "" ? null : Number(fields[2].value) };
  });
  saveSettings({ managers, stages });
});
element("reset").addEventListener("click", () => saveSettings(structuredClone(DEFAULT_SETTINGS)));
element("filters").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!loaded) return;
  const next = { from: input("from").value, to: input("to").value, manager: input("manager").value.trim() };
  try {
    filterRows([], next.from, next.to, next.manager, settings);
    filters = next;
    page = 0;
    error();
    showReport();
  } catch (err) { error((err as Error).message); }
});
element("previous").addEventListener("click", () => { page--; showDetails(); });
element("next").addEventListener("click", () => { page++; showDetails(); });
function download(content: string, kind: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `kpi-${kind}-${filters.from}-${filters.to}.csv`;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
element("summary-csv").addEventListener("click", () => download(summaryCsv(filtered, settings), "summary"));
element("detail-csv").addEventListener("click", () => download(detailCsv(filtered, settings), "details"));
function logout(message = "", clearStorage = true) {
  session++;
  token = "";
  if (clearStorage) {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  }
  rows = [];
  filtered = [];
  loaded = false;
  cdekLoaded = false;
  element("summary-body").replaceChildren();
  element("detail-body").replaceChildren();
  element("cdek-months-body").replaceChildren();
  element("report").hidden = true;
  element("cdek-report").hidden = true;
  element("cdek-status").textContent = "";
  element("cdek-stored").textContent = "";
  element("cdek-max").textContent = "";
  element("cdek-final").textContent = "";
  cdekError();
  showTab("kpi");
  element("workspace").hidden = true;
  element("login-panel").hidden = false;
  element("login-error").textContent = message;
  input("password").value = "";
  showSettings();
}
element("logout").addEventListener("click", () => logout());
element("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = element<HTMLButtonElement>("login-button");
  button.disabled = true;
  element("login-error").textContent = "";
  try {
    const response = await fetch("/web/db_ui/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: input("password").value }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      throw new Error(response.status === 401 ? "Неверный пароль." :
        response.status === 429 ? "Слишком много попыток. Повторите через минуту." :
        response.status === 503 ? "Авторизация на сервере не настроена." : "Не удалось войти. Повторите попытку.");
    }
    const data = await response.json();
    if (typeof data.token !== "string" || !data.token) throw new Error("Некорректный ответ сервера.");
    try { localStorage.setItem(TOKEN_KEY, data.token); } catch {
      throw new Error("Браузер не разрешил сохранить токен. Разрешите локальное хранилище.");
    }
    token = data.token;
    session++;
    input("password").value = "";
    await load();
  } catch (err) {
    element("login-error").textContent = err instanceof Error ? err.message : "Ошибка входа.";
  } finally { button.disabled = false; }
});
window.addEventListener("storage", (event) => {
  if (event.key === TOKEN_KEY || event.key === null) logout("Войдите снова.", false);
});
async function load() {
  if (!token) return;
  const currentSession = session;
  element("login-panel").hidden = true;
  element("workspace").hidden = false;
  const button = element<HTMLButtonElement>("reload");
  button.disabled = true;
  error();
  element("status").textContent = "Загрузка данных…";
  try {
    const response = await fetch("/web/db_ui/kpi", { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    if (currentSession !== session) return;
    if (response.status === 401) { logout("Сессия недействительна. Войдите снова."); return; }
    if (!response.ok) throw new Error(`Не удалось загрузить данные (HTTP ${response.status}).`);
    const data: unknown = await response.json();
    if (!Array.isArray(data) || !data.every((r) => r && Number.isInteger(r.id) &&
      [r.leadId, r.responsibleUser, r.statusUser, r.kpiType].every((v) => typeof v === "string") &&
      [r.kpiReachedAt, r.leadCreatedAt, r.price].every((v) => v === null || typeof v === "number" && Number.isFinite(v)))) {
      throw new Error("Сервер вернул данные в неожиданном формате.");
    }
    if (currentSession !== session) return;
    rows = data;
    loaded = true;
    page = 0;
    showSettings();
    showReport();
    element("status").textContent = `Загружено записей: ${rows.length} · Обновлено ${dateTime(Math.floor(Date.now() / 1000))} МСК`;
  } catch (err) {
    if (currentSession !== session) return;
    error(err instanceof Error ? err.message : "Ошибка загрузки данных.");
    element("status").textContent = loaded ? "Не удалось обновить данные. Показан предыдущий снимок." : "Данные не загружены. Повторите попытку.";
  } finally { button.disabled = false; }
}
element("reload").addEventListener("click", load);
element("tab-kpi-btn").addEventListener("click", () => showTab("kpi"));
element("tab-cdek-btn").addEventListener("click", () => showTab("cdek"));
element("cdek-filters").addEventListener("submit", (event) => {
  event.preventDefault();
  void loadCdek();
});
showSettings();
void load();
