import { Body, Controller, Post, Get } from "@nestjs/common";
import { type UtmEntry, UtmService } from "./utm.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly utmService: UtmService) {}

  @Post("utm")
  async addUtm(@Body() data: UtmEntry): Promise<string> {
    this.utmService.add(data);
    return "OK";
  }

  @Get("utm")
  async getUtm(): Promise<string[]> {
    return this.utmService.listToString();
  }
}
