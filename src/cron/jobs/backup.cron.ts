import { $ } from "bun";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { DbService } from "../../db/db.service";
import { CronService } from "../cron.service";

@Injectable()
export class BackupJob extends CronService {
  constructor(config: ConfigService, private readonly db: DbService) {
    super(config);
  }

  @Cron("0 0 5 * * *")
  async backupJob(): Promise<void> {
    try {
      const backupPath = await this.db.backup();
      if (!(await Bun.file("backup.sh").exists())) {
        this.logger.warn(`Database backup created at ${backupPath}; backup.sh not found, skipping script`);
        return;
      }

      const { exitCode, stderr } = await $`./backup.sh`.nothrow().quiet();
      if (exitCode !== 0) {
        throw new Error(`backup.sh exited with code ${exitCode}: ${stderr.toString()}`);
      }

      this.logger.log(`Database backup created at ${backupPath}; backup.sh completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to run database backup: ${error.message}`, error.stack);
    }
  }
}
