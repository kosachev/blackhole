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
    this.client = new YandexDiskClient(this.config.get("YANDEX_DISK_TOKEN"));
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
    if (!upload_url) throw new Error("Yadisk: failed to get upload url");
    await this.client.uploadFile(upload_url, data);
    const publish_url = await this.client.publishFile(dest);
    if (!publish_url) throw new Error("Yadisk: failed to publish file");
    return publish_url;
  }

  async getDownloadUrl(public_url: string): Promise<string> {
    const res = await this.client.getPublicFileUrl(public_url);
    return res.href;
  }
}
