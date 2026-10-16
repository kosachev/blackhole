import { Controller, Get, Header, Query, UseFilters, UseGuards } from "@nestjs/common";
import { GlobalExceptionFilter } from "../utils/global-exception.filter";
import { DbUiService } from "./db-ui.service";

import { DbUiAuthGuard } from "./db-ui-auth.guard";

@Controller("web/db_ui")
@UseFilters(GlobalExceptionFilter)
@UseGuards(DbUiAuthGuard)
export class DbUiController {
  constructor(private readonly dbUi: DbUiService) {}

  @Get("kpi")
  @Header("Cache-Control", "no-store")
  getKpi() {
    return this.dbUi.getKpi();
  }

  @Get("cdek-delta")
  @Header("Cache-Control", "no-store")
  getCdekDelta(@Query("from") from?: string, @Query("to") to?: string) {
    return this.dbUi.getCdekDelta(from, to);
  }
}
