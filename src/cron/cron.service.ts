import { Injectable, Logger } from "@nestjs/common";
import { Cron, Interval } from "@nestjs/schedule";

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  // TODO: draft, delete
  @Interval(60000)
  job(): void {
    this.logger.debug("Called every minute");
  }

  // TODO: draft, delete
  @Cron("45 * * * * *")
  job2(): void {
    this.logger.debug("Called when the current second is 45");
  }
}
