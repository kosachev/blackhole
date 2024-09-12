import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { YandexMetrikaClient, type CSVData } from "./yandex-metrika.lib";

@Injectable()
export class YandexMetrikaService {
  private readonly logger = new Logger(YandexMetrikaService.name);
  private client: YandexMetrikaClient;

  constructor(private readonly config: ConfigService) {
    this.client = new YandexMetrikaClient(this.config.get("YANDEX_METRIKA_TOKEN"));
  }

  async upload(counter: number, data: CSVData, comment?: string) {
    return this.client.upload(counter, data, comment);
  }
}
