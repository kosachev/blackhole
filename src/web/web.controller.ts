import { Body, Controller, Post } from "@nestjs/common";
import { RequestPartialReturn, PartialReturnService } from "./partial-return.service";

@Controller("web")
export class WebController {
  constructor(private readonly partial_return: PartialReturnService) {}

  @Post("partial_return")
  async request(@Body() data: RequestPartialReturn) {
    return this.partial_return.handler(data);
  }
}
