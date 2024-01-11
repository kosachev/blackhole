import { Controller, Post } from "@nestjs/common";
import { CdekService } from "./cdek.service";
import { FetchRequest } from "../utils/fetch-request.decorator";

@Controller("cdek")
export class CdekController {
  private handler: (request: Request) => Promise<Response>;

  constructor(private cdek: CdekService) {
    this.handler = cdek.client.webhookHandler();
  }

  @Post("webhook")
  async handle(@FetchRequest() request: Request): Promise<string> {
    this.handler(request);

    return "OK";
  }
}
