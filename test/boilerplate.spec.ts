import { describe, test, beforeAll, afterAll } from "bun:test";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { AmoService } from "../src/amo/amo.service";
import { ArchiveLogsJob } from "../src/cron/jobs/archive-logs.cron";

describe("Boilerplate", () => {
  let app: INestApplication;
  let service: AmoService;
  let cron: ArchiveLogsJob;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    service = moduleRef.get<AmoService>(AmoService);
    cron = moduleRef.get<ArchiveLogsJob>(ArchiveLogsJob);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test("code here", async () => {
    console.log("Boilerplate starts");

    // const data = await service.client.account.getAccount();
    const data = await cron.archiveJob();

    console.log(data);
  });
});
