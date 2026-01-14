import { describe, test, expect, beforeAll, afterAll, setSystemTime } from "bun:test";
import { ArchiveLogsJob } from "../src/cron/jobs/archive-logs.cron";
import { ConfigService } from "@nestjs/config";
import fs from "node:fs/promises";
import path from "node:path";

describe("ArchiveLogsJob", () => {
  const testLogsDir = path.join(import.meta.dir, "test-logs");
  const testArchiveDir = path.join(import.meta.dir, "test-archives");

  let job: ArchiveLogsJob;
  let configService: ConfigService;

  beforeAll(async () => {
    await fs.mkdir(testLogsDir, { recursive: true });
    await fs.mkdir(testArchiveDir, { recursive: true });

    configService = {
      get: (key: string) => {
        if (key === "LOG_ARCHIVE_PATH") return testArchiveDir;
        if (key === "LOGS_PATH") return testLogsDir;
        return null;
      },
    } as any;

    job = new ArchiveLogsJob(configService);
  });

  afterAll(async () => {
    await fs.rm(testLogsDir, { recursive: true, force: true });
    await fs.rm(testArchiveDir, { recursive: true, force: true });
    setSystemTime();
  });

  test("should archive logs from previous month", async () => {
    // Mock date to 2026-02-15 so prev month is 2026-01
    const mockDate = new Date(2026, 1, 15);
    setSystemTime(mockDate);

    const logFile1 = "2026-01-01.log";
    const logFile2 = "2026-01-02.log";
    const otherLog = "2026-02-01.log";

    await fs.writeFile(path.join(testLogsDir, logFile1), "log 1");
    await fs.writeFile(path.join(testLogsDir, logFile2), "log 2");
    await fs.writeFile(path.join(testLogsDir, otherLog), "log 3");

    await job.archiveJob();

    const archivedFile = path.join(testArchiveDir, "2026-01.tar.gz");
    const archiveExists = await fs.exists(archivedFile);
    expect(archiveExists).toBe(true);

    const filesInLogs = await fs.readdir(testLogsDir);
    expect(filesInLogs).toContain(otherLog);
    expect(filesInLogs).not.toContain(logFile1);
    expect(filesInLogs).not.toContain(logFile2);
  });
});
