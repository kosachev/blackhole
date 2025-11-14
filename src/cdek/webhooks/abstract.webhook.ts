import { Amo } from "@shevernitskiy/amo";
import { Cdek } from "cdek";
import { Injectable, Logger } from "@nestjs/common";
import { AmoService } from "../../amo/amo.service";
import { CdekService } from "../cdek.service";
import { TelegramService } from "../../telegram/telegram.service";
import { YandexDiskService } from "../../yandex-disk/yandex-disk.service";
import { GoogleSheetsService } from "../../google-sheets/google-sheets.service";

@Injectable()
export abstract class AbstractWebhook {
  protected readonly logger: Logger = new Logger(CdekService.name);
  protected readonly amo: Amo;
  protected readonly cdek: Cdek;

  constructor(
    protected readonly amo_service: AmoService,
    protected readonly cdek_service: CdekService,
    protected readonly telegram: TelegramService,
    protected readonly yadisk: YandexDiskService,
    protected readonly googleSheets: GoogleSheetsService,
  ) {
    this.amo = this.amo_service.client;
    this.cdek = this.cdek_service.client;
  }

  abstract handle(data: unknown): unknown;
}
