import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

import { Cron } from "@nestjs/schedule";
import { CronService } from "../cron.service";

export class ArchiveLogsJob extends CronService {
  // every month on 1 day at 9:00
  @Cron("0 0 9 1 * *")
  async archiveJob(): Promise<void> {
    const date = new Date();

    date.setMonth(date.getMonth() - 1);
    const prevMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

    const logsDir = this.config.get<string>("LOGS_PATH") || "./logs";
    const archiveDir = this.config.get<string>("LOG_ARCHIVE_PATH");
    const archivePath = join(archiveDir, `${prevMonth}.tar.gz`);

    try {
      const filesInLogs = await readdir(logsDir);
      const filesToArchive: Record<string, any> = {};

      for (const file of filesInLogs) {
        if (file.startsWith(prevMonth) && file.endsWith(".log")) {
          filesToArchive[file] = await Bun.file(join(logsDir, file)).bytes();
        }
      }

      if (Object.keys(filesToArchive).length === 0) {
        this.logger.log(`No logs found for ${prevMonth} to archive`);
        return;
      }

      const archive = new Bun.Archive(filesToArchive, { compress: "gzip" });
      await Bun.write(archivePath, await archive.bytes());

      for (const file in filesToArchive) {
        await unlink(join(logsDir, file));
      }

      this.logger.log(`Logs archived to ${archivePath}`);
    } catch (error) {
      this.logger.error(`Failed to archive logs: ${error.message}`);
    }
  }
}
