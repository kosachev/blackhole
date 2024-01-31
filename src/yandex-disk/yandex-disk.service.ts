import fs from "node:fs";
import path from "node:path";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { YandexDiskClient } from "./yandex-disk.lib";

@Injectable()
export class YandexDiskService {
  private readonly logger = new Logger(YandexDiskService.name);
  private client: YandexDiskClient;

  constructor(private readonly config: ConfigService) {
    this.client = new YandexDiskClient(this.config.get("YANDEX_DISK_TOKEN"), (error) =>
      this.logger.error(error),
    );
  }

  // upload local file by path
  async upload(file_path: string): Promise<string>;
  // upload data from buffer to target file with name
  async upload(name: string, data: Buffer): Promise<string>;
  async upload(file: string, data?: Buffer): Promise<string> {
    if (!data) {
      data = fs.readFileSync(file);
    }
    const dest = this.config.get("YANDEX_DISK_TARGET_PATH") + path.basename(file);
    const upload_url = await this.client.getUploadUrl(dest);
    await this.client.uploadFile(upload_url, data);
    const publish_url = await this.client.publishFile(dest);
    return publish_url;
  }
}
