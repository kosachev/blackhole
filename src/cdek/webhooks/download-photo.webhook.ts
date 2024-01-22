import { UpdateDownloadPhoto } from "cdek/src/types/api/webhook";
import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";

@Injectable()
export class DownloadPhotoWebhook extends AbstractWebhook {
  async handle(data: UpdateDownloadPhoto) {
    this.logger.debug("incoming webhook download-photo");
    this.logger.debug({ data });
    // this.amo, this.cdek is avaible here
  }
}
