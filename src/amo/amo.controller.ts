import { Controller, Post } from "@nestjs/common";
import { AmoService } from "./amo.service";
import { FetchRequest } from "../utils/fetch-request.decorator";

@Controller("amo")
export class AmoController {
  private handler: (request: Request) => Promise<Response>;

  constructor(private amo: AmoService) {
    this.handler = amo.client.webhookHandler();
  }

  @Post("webhook")
  async handle(@FetchRequest() request: Request): Promise<string> {
    this.handler(request);
    return "OK";
  }
}
