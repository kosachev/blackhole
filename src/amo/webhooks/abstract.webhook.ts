import { Amo } from "@shevernitskiy/amo";
import { Cdek } from "cdek";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AmoService } from "../amo.service";
import { CdekService } from "../../cdek/cdek.service";
import { TelegramService } from "../../telegram/telegram.service";
import { MailService } from "../../mail/mail.service";
import { PDFService } from "../../pdf/pdf.service";
import { YandexDiskService } from "../../yandex-disk/yandex-disk.service";

@Injectable()
export abstract class AbstractWebhook {
  protected readonly logger: Logger = new Logger(AmoService.name);
  protected readonly amo: Amo;
  protected readonly cdek: Cdek;

  constructor(
    protected readonly config: ConfigService,
    private readonly amo_service: AmoService,
    private readonly cdek_service: CdekService,
    protected readonly telegram: TelegramService,
    protected readonly mail: MailService,
    protected readonly pdf: PDFService,
    protected readonly yadisk: YandexDiskService,
  ) {
    this.amo = this.amo_service.client;
    this.cdek = this.cdek_service.client;
  }

  abstract handle(data: unknown): void | Promise<void>;
}
