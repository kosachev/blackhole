import { Interval } from "@nestjs/schedule";
import { CronService } from "../cron.service";

export class TestJob extends CronService {
  @Interval(10000)
  testjob(): void {
    this.logger.debug("from test job");
  }
}
