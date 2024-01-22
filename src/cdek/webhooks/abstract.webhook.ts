import { Amo } from "@shevernitskiy/amo";
import { Cdek } from "cdek";
import { Injectable, Logger } from "@nestjs/common";
import { AmoService } from "../../amo/amo.service";
import { CdekService } from "../cdek.service";

@Injectable()
export abstract class AbstractWebhook {
  protected readonly logger: Logger = new Logger(CdekService.name);
  protected readonly amo: Amo;
  protected readonly cdek: Cdek;

  constructor(
    private readonly amo_service: AmoService,
    private readonly cdek_service: CdekService,
  ) {
    this.amo = this.amo_service.client;
    this.cdek = this.cdek_service.client;
  }

  abstract handle(data: unknown): void | Promise<void>;
}
