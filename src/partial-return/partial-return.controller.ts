import { Body, Controller, Post } from "@nestjs/common";
import { RequestPartialReturn, PartialReturnService } from "./partial-return.service";

@Controller("partial_return")
export class PartialReturnController {
  constructor(private readonly service: PartialReturnService) {}

  @Post()
  async request(@Body() data: RequestPartialReturn) {
    return this.service.handler(data);
  }
}
