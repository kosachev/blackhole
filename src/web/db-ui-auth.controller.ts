import { Body, Controller, Header, HttpCode, Ip, Post, UseFilters } from "@nestjs/common";
import { GlobalExceptionFilter } from "../utils/global-exception.filter";
import { DbUiAuthService } from "./db-ui-auth.service";

@Controller("web/db_ui")
@UseFilters(GlobalExceptionFilter)
export class DbUiAuthController {
  constructor(private readonly auth: DbUiAuthService) {}

  @Post("login")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  login(@Body() body: { password?: unknown } | null, @Ip() ip: string) {
    return this.auth.login(body?.password, ip);
  }
}
