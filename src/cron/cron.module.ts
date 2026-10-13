import { Module } from "@nestjs/common";
import { ArchiveLogsJob } from "./jobs/archive-logs.cron";
import { BackupJob } from "./jobs/backup.cron";
import { TestJob } from "./jobs/test.cron";

@Module({
  providers: [TestJob, ArchiveLogsJob, BackupJob],
})
export class CronModule {}
