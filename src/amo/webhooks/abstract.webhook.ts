import { Injectable, Logger } from "@nestjs/common";
import { AmoService } from "../amo.service";
import { Amo } from "@shevernitskiy/amo";

@Injectable()
export abstract class AbstractWebhook {
  protected readonly logger: Logger = new Logger(AmoService.name);
  protected readonly amo: Amo;

  constructor(protected readonly amo_service: AmoService) {
    this.amo = this.amo_service.client;
  }

  abstract handle(data: unknown): void | Promise<void>;
}
