import { Module } from "@nestjs/common";
import { ArchiveLogsJob } from "./jobs/archive-logs.cron";
import { TestJob } from "./jobs/test.cron";

@Module({
  providers: [TestJob, ArchiveLogsJob],
})
export class CronModule {}
