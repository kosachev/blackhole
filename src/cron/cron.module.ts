import { Module } from "@nestjs/common";
import { TestJob } from "./jobs/test.cron";

@Module({
  providers: [TestJob],
})
export class CronModule {}
