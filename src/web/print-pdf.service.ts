import { Injectable, InternalServerErrorException } from "@nestjs/common";

import { YandexDiskService } from "../yandex-disk/yandex-disk.service";

@Injectable()
export class PrintPdfService {
  constructor(private readonly yadisk: YandexDiskService) {}

  async handler(url: string): Promise<ReadableStream<Uint8Array>> {
    if (!url.startsWith("https://yadi.sk/")) {
      throw new InternalServerErrorException("Invalid url");
    }
    const download_url = await this.yadisk.getDownloadUrl(url);
    const res = await fetch(download_url);
    return res.body;
  }
}
