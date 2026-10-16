import { BadRequestException, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DbService } from "../db/db.service";

export type CdekDeltaRow = {
  leadId: string;
  shippingDate: number;
  deliveryType: string;
  closedByRegister: string;
  customerDeliveryPrice: number | null;
  ownerDeliveryPrice: number | null;
  ownerReturnDeliveryPrice: number | null;
};

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

type CdekDeal = {
  shippingDate: number | null;
  isCdek: boolean;
  registryClosed: boolean;
  clientDelivery: number;
  companyDelivery: number;
  companyReturn: number;
};

const MOSCOW_OFFSET_SEC = 3 * 3600;

const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

const CLOSED_EMPTY_VALUES = new Set(["", "false", "ложь", "нет", "no", "0"]);

@Injectable()
export class CdekDeltaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CdekDeltaService.name);

  constructor(private readonly db: DbService) {}

  getDelta(from: number, to: number = Math.floor(Date.now() / 1000)): CdekDeltaResult {
    const rows = this.db.sales.findByShippingDateRange(from, to);
    return CdekDeltaService.calculate(rows, from, to);
  }

  static twoClosedMonthsRange(nowSec: number = Math.floor(Date.now() / 1000)): {
    from: number;
    to: number;
  } {
    const current = CdekDeltaService.moscowYearMonth(nowSec);
    const first = CdekDeltaService.shiftMonth(current.year, current.month, -2);
    return {
      from: CdekDeltaService.moscowMonthStartSec(first.year, first.month),
      to: CdekDeltaService.moscowMonthStartSec(current.year, current.month) - 1,
    };
  }

  static dayRange(fromDate: string, toDate: string): { from: number; to: number } {
    const from = CdekDeltaService.moscowMidnight(fromDate);
    const to = CdekDeltaService.moscowMidnight(toDate);
    if (from === null || to === null) {
      throw new BadRequestException("Invalid CDEK delta dates, expected YYYY-MM-DD");
    }
    if (from > to) {
      throw new BadRequestException("Invalid CDEK delta interval: from is later than to");
    }
    return { from, to: to + 86400 - 1 };
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.updateTwoClosedMonthsAverage();
  }

  // every Monday at 5:00 AM
  @Cron("0 0 5 * * 1")
  async updateTwoClosedMonthsAverage(): Promise<void> {
    try {
      const { from, to } = CdekDeltaService.twoClosedMonthsRange();
      const result = this.getDelta(from, to);
      this.db.cdekPrice.setCdekDelta(result.total.averageDelta);
      this.logger.log(
        `CDEK_DELTA, two closed months average updated ${result.total.averageDelta}, deals ${result.total.dealsCount}`,
      );
    } catch (error) {
      this.logger.error("CDEK_DELTA, failed to update two closed months average", error);
    }
  }

  static calculate(
    rows: CdekDeltaRow[],
    from: number,
    to: number = Math.floor(Date.now() / 1000),
  ): CdekDeltaResult {
    if (from > to) {
      throw new Error(`Invalid CDEK delta interval: from (${from}) is later than to (${to})`);
    }

    const deals = new Map<string, CdekDeal>();

    for (const row of rows) {
      const dealId = row.leadId?.trim();
      if (!dealId) continue;

      let deal = deals.get(dealId);
      if (!deal) {
        deal = {
          shippingDate: null,
          isCdek: false,
          registryClosed: false,
          clientDelivery: 0,
          companyDelivery: 0,
          companyReturn: 0,
        };
        deals.set(dealId, deal);
      }

      const shippingDate =
        typeof row.shippingDate === "number" && Number.isFinite(row.shippingDate)
          ? row.shippingDate
          : null;
      if (shippingDate !== null && (deal.shippingDate === null || shippingDate < deal.shippingDate)) {
        deal.shippingDate = shippingDate;
      }

      deal.isCdek = deal.isCdek || CdekDeltaService.normalizeText(row.deliveryType).includes("сдэк");
      deal.registryClosed = deal.registryClosed || CdekDeltaService.isRegistryClosed(row.closedByRegister);
      deal.clientDelivery = Math.max(deal.clientDelivery, CdekDeltaService.toMoney(row.customerDeliveryPrice));
      deal.companyDelivery = Math.max(deal.companyDelivery, CdekDeltaService.toMoney(row.ownerDeliveryPrice));
      deal.companyReturn = Math.max(deal.companyReturn, CdekDeltaService.toMoney(row.ownerReturnDeliveryPrice));
    }

    const months = CdekDeltaService.buildMonthSlices(from, to);
    const byKey = new Map(months.map((month) => [month.key, month]));
    const total = CdekDeltaService.emptyMetrics();

    deals.forEach((deal) => {
      if (deal.shippingDate === null || !deal.isCdek || !deal.registryClosed) return;
      if (deal.shippingDate < from || deal.shippingDate > to) return;

      const month = byKey.get(CdekDeltaService.moscowMonthKey(deal.shippingDate));
      if (!month) return;

      CdekDeltaService.addDeal(month, total, deal);
    });

    for (const month of months) {
      CdekDeltaService.roundMetrics(month);
    }
    CdekDeltaService.roundMetrics(total);

    return { from, to, total, months };
  }

  private static normalizeText(value: unknown): string {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("ru-RU")
      .replace(/\s+/g, " ");
  }

  private static isRegistryClosed(value: unknown): boolean {
    if (value === null || value === undefined || value === "" || value === false) return false;
    if (typeof value === "number") return value !== 0;
    if (value instanceof Date) return !Number.isNaN(value.getTime());

    return !CLOSED_EMPTY_VALUES.has(CdekDeltaService.normalizeText(value));
  }

  private static toMoney(value: number | null | undefined): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  private static roundMetrics(metrics: CdekDeltaMetrics): void {
    metrics.clientDelivery = CdekDeltaService.roundMoney(metrics.clientDelivery);
    metrics.companyDelivery = CdekDeltaService.roundMoney(metrics.companyDelivery);
    metrics.companyReturn = CdekDeltaService.roundMoney(metrics.companyReturn);
    metrics.companyTotal = CdekDeltaService.roundMoney(metrics.companyTotal);
    metrics.delta = CdekDeltaService.roundMoney(metrics.delta);
    metrics.averageDelta = CdekDeltaService.roundMoney(
      metrics.dealsCount ? metrics.delta / metrics.dealsCount : 0,
    );
  }

  private static roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private static emptyMetrics(): CdekDeltaMetrics {
    return {
      dealsCount: 0,
      clientDelivery: 0,
      companyDelivery: 0,
      companyReturn: 0,
      companyTotal: 0,
      delta: 0,
      averageDelta: 0,
    };
  }

  private static addDeal(month: CdekDeltaMonth, total: CdekDeltaMetrics, deal: CdekDeal): void {
    const companyTotal = deal.companyDelivery + deal.companyReturn;
    const delta = deal.clientDelivery - companyTotal;

    month.dealsCount += 1;
    month.clientDelivery += deal.clientDelivery;
    month.companyDelivery += deal.companyDelivery;
    month.companyReturn += deal.companyReturn;
    month.companyTotal += companyTotal;
    month.delta += delta;

    total.dealsCount += 1;
    total.clientDelivery += deal.clientDelivery;
    total.companyDelivery += deal.companyDelivery;
    total.companyReturn += deal.companyReturn;
    total.companyTotal += companyTotal;
    total.delta += delta;
  }

  private static moscowYearMonth(timestampSec: number): { year: number; month: number } {
    const shifted = new Date((timestampSec + MOSCOW_OFFSET_SEC) * 1000);
    return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
  }

  private static moscowMidnight(date: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const utc = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== date) return null;
    return utc / 1000 - MOSCOW_OFFSET_SEC;
  }

  private static moscowMonthKey(timestampSec: number): string {
    const { year, month } = CdekDeltaService.moscowYearMonth(timestampSec);
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  private static moscowMonthStartSec(year: number, month: number): number {
    return Date.UTC(year, month - 1, 1) / 1000 - MOSCOW_OFFSET_SEC;
  }

  private static nextMonthStartSec(year: number, month: number): number {
    const next = CdekDeltaService.shiftMonth(year, month, 1);
    return CdekDeltaService.moscowMonthStartSec(next.year, next.month);
  }

  private static shiftMonth(
    year: number,
    month: number,
    offset: number,
  ): { year: number; month: number } {
    const zeroBased = year * 12 + (month - 1) + offset;
    return {
      year: Math.floor(zeroBased / 12),
      month: ((zeroBased % 12) + 12) % 12 + 1,
    };
  }

  private static buildMonthSlices(from: number, to: number): CdekDeltaMonth[] {
    const start = CdekDeltaService.moscowYearMonth(from);
    const end = CdekDeltaService.moscowYearMonth(to);
    const count = (end.year - start.year) * 12 + (end.month - start.month);
    const slices: CdekDeltaMonth[] = [];

    for (let offset = 0; offset <= count; offset++) {
      const { year, month } = CdekDeltaService.shiftMonth(start.year, start.month, offset);
      const monthStart = CdekDeltaService.moscowMonthStartSec(year, month);
      const nextStart = CdekDeltaService.nextMonthStartSec(year, month);

      slices.push({
        ...CdekDeltaService.emptyMetrics(),
        key: `${year}-${String(month).padStart(2, "0")}`,
        label: `${MONTH_LABELS[month - 1]} ${year}`,
        from: Math.max(monthStart, from),
        to: Math.min(nextStart - 1, to),
      });
    }

    return slices;
  }
}
