import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import * as tar from "tar-fs";

import { Cron } from "@nestjs/schedule";
import { CronService } from "../cron.service";

export class ArchiveLogsJob extends CronService {
  // every month on 1 day at 9:00
  @Cron("0 0 9 1 * *")
  async archiveJob(): Promise<void> {
    const date = new Date();

    date.setMonth(date.getMonth() - 1);
    const prev_month = `${date.getFullYear()}-${date.getMonth() + 1 < 10 ? "0" : ""}${date.getMonth() + 1}`;

    const archive = fs.createWriteStream(
      path.join(this.config.get<string>("LOG_ARCHIVE_PATH"), `${prev_month}.tar.gz`),
    );
    const gzip = zlib.createGzip();
    gzip.pipe(archive);
    tar
      .pack("./logs", {
        filter: (name) =>
          !path.basename(name).startsWith(prev_month) || !path.basename(name).endsWith(".log"),
      })
      .pipe(gzip);

    await new Promise((resolve, reject) => {
      archive.on("finish", () => resolve(undefined));
      archive.on("error", reject);
    });
    for (const file of fs.readdirSync("./logs")) {
      if (!file.startsWith(prev_month) || !file.endsWith(".log")) continue;
      fs.unlinkSync(`./logs/${file}`);
    }

    this.logger.log(`Logs archived to ${archive.path}`);
  }
}
