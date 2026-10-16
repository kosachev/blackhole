import { Controller, Get, Header, Query, UseFilters, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GlobalExceptionFilter } from "../utils/global-exception.filter";
import { DbUiService } from "./db-ui.service";
import { DeliveryPriceService } from "./delivery-price.service";

import { DbUiAuthGuard } from "./db-ui-auth.guard";

@Controller("web/db_ui")
@UseFilters(GlobalExceptionFilter)
@UseGuards(DbUiAuthGuard)
export class DbUiController {
  constructor(
    private readonly dbUi: DbUiService,
    private readonly config: ConfigService,
    private readonly deliveryPrice: DeliveryPriceService,
  ) {}

  @Get("kpi")
  @Header("Cache-Control", "no-store")
  getKpi() {
    return this.dbUi.getKpi();
  }

  @Get("cdek-delta")
  @Header("Cache-Control", "no-store")
  getCdekDelta(@Query("from") from?: string, @Query("to") to?: string) {
    const maxAddition = Number(this.config.get("CDEK_MAX_PRICE_ADDITION"));
    return {
      ...this.dbUi.getCdekDelta(from, to),
      maxAddition: Number.isFinite(maxAddition) ? maxAddition : null,
      finalAddition: this.deliveryPrice.getCdekPriceAddition(),
    };
  }
}
