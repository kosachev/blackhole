import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GlobalExceptionFilter } from "../utils/global-exception.filter";
import { DbUiService } from "./db-ui.service";
import { DeliveryPriceService } from "./delivery-price.service";

import { DbUiAuthGuard, dbUiScope, type DbUiRequest } from "./db-ui-auth.guard";
import { DbUiAuthService } from "./db-ui-auth.service";

@Controller("web/db_ui")
@UseFilters(GlobalExceptionFilter)
@UseGuards(DbUiAuthGuard)
export class DbUiController {
  constructor(
    private readonly dbUi: DbUiService,
    private readonly config: ConfigService,
    private readonly deliveryPrice: DeliveryPriceService,
    private readonly auth: DbUiAuthService,
  ) {}

  @Get("kpi")
  @Header("Cache-Control", "no-store")
  getKpi(@Req() request: DbUiRequest) {
    const scope = dbUiScope(request);
    return this.dbUi.getKpi(scope.users ?? undefined);
  }

  @Get("cdek-delta")
  @Header("Cache-Control", "no-store")
  getCdekDelta(@Req() request: DbUiRequest, @Query("from") from?: string, @Query("to") to?: string) {
    if (!dbUiScope(request).admin) throw new ForbiddenException();
    const maxAddition = Number(this.config.get("CDEK_MAX_PRICE_ADDITION"));
    return {
      ...this.dbUi.getCdekDelta(from, to),
      maxAddition: Number.isFinite(maxAddition) ? maxAddition : null,
      finalAddition: this.deliveryPrice.getCdekPriceAddition(),
    };
  }

  @Post("guest")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  createGuest(
    @Req() request: DbUiRequest,
    @Body() body: { manager?: unknown; users?: unknown; settings?: unknown } | null,
  ) {
    if (!dbUiScope(request).admin) throw new ForbiddenException();
    return { token: this.auth.issueGuest(body?.manager, body?.users, body?.settings) };
  }
}
