import { Body, Controller, Post } from "@nestjs/common";
import { RequestPartialReturn, PartialReturnService } from "./partial-return.service";
import { CdekPickupService, RequestCdekPickup } from "./cdek-pickup.service";

@Controller("web")
export class WebController {
  constructor(
    private readonly partial_return: PartialReturnService,
    private readonly cdek_pickup: CdekPickupService,
  ) {}

  @Post("partial_return")
  async partialReturn(@Body() data: RequestPartialReturn) {
    return this.partial_return.handler(data);
  }

  @Post("cdek_pickup")
  async cdekPickup(@Body() data: RequestCdekPickup) {
    return this.cdek_pickup.handler(data);
  }
}
