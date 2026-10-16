import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service";
import { CdekDeltaService, type CdekDeltaResult } from "../cdek/cdek-delta.service";

@Injectable()
export class DbUiService {
  constructor(private readonly db: DbService) {}

  getKpi() {
    return this.db.kpi.getKpi();
  }

  getCdekDelta(fromDate?: string, toDate?: string): {
    storedDelta: number | null;
    calculation: CdekDeltaResult;
  } {
    const { from, to } =
      fromDate === undefined && toDate === undefined
        ? CdekDeltaService.twoClosedMonthsRange()
        : CdekDeltaService.dayRange(fromDate ?? "", toDate ?? "");
    return {
      storedDelta: this.db.cdekPrice.getCdekDelta() ?? null,
      calculation: CdekDeltaService.calculate(
        this.db.sales.findByShippingDateRange(from, to),
        from,
        to,
      ),
    };
  }
}
