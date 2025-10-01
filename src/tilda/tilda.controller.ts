import {
  Body,
  Controller,
  Post,
  ForbiddenException,
  Headers,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TildaService } from "./tilda.service";
import { AutoOkResponse } from "src/utils/auto-ok-response.interceptor";

@Controller("tilda")
export class TildaController {
  constructor(
    private readonly config: ConfigService,
    private readonly tildaService: TildaService,
  ) {}

  @UseInterceptors(AutoOkResponse)
  @Post("new_order")
  async webhook(@Body() data: any, @Headers() headers: Headers): Promise<string> {
    if (data["test"] === "test") return "OK";

    if (data["sigma"] !== this.config.get("TILDA_SECRET_KEY")) {
      throw new ForbiddenException("Unouthorized, wrong secret key");
    }

    await this.tildaService.handler(data, headers);
    return "OK";
  }
}
