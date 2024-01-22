import { UpdateOrderStatus } from "cdek/src/types/api/webhook";
import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";

@Injectable()
export class OrderStatusWebhook extends AbstractWebhook {
  async handle(data: UpdateOrderStatus) {
    this.logger.debug("incoming webhook order-status");
    this.logger.debug({ data });
    // this.amo, this.cdek is avaible here
  }
}
