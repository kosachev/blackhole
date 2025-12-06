import type { UpdateDownloadPhoto } from "cdek/src/types/api/webhook";
import { Injectable, NotImplementedException } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";

@Injectable()
export class DownloadPhotoWebhook extends AbstractWebhook {
  async handle(data: UpdateDownloadPhoto) {
    this.logger.debug({ data });
    // this.amo, this.cdek is avaible here
    throw new NotImplementedException("DownloadPhotoWebhook handler not implemented");
  }
}
