import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import * as tar from "tar-fs";

import { Cron } from "@nestjs/schedule";
import { CronService } from "../cron.service";

export class ArchiveLogsJob extends CronService {
  @Cron("0 0 1 1 * *")
  async archiveJob(): Promise<void> {
    const date = new Date();

    const today = date.toISOString().split("T")[0] + ".log";
    date.setMonth(date.getMonth() - 1);
    const prev_month = `${date.getFullYear()}-${date.getMonth() + 1 < 10 ? "0" : ""}${date.getMonth() + 1}`;
    const archive = fs.createWriteStream(
      `${this.config.get<string>("LOG_ARCHIVE_PATH")}/${prev_month}.tar.gz`,
    );
    const gzip = zlib.createGzip();
    gzip.pipe(archive);
    tar.pack("./logs", { filter: (name) => path.basename(name) === today }).pipe(gzip);

    await new Promise((resolve, reject) => {
      archive.on("finish", resolve);
      archive.on("error", reject);
    });

    for (const file of fs.readdirSync("./logs")) {
      if (file === today) continue;
      fs.unlinkSync(`./logs/${file}`);
    }

    this.logger.log(`Logs archived to ${prev_month}.tar.gz`);
  }
}
