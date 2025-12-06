import { describe, test, beforeAll, afterAll } from "bun:test";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { AmoService } from "../src/amo/amo.service";

describe("Boilerplate", () => {
  let app: INestApplication;
  let service: AmoService;

  beforeAll(async () => {
    const mobuldeRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mobuldeRef.createNestApplication();
    service = mobuldeRef.get<AmoService>(AmoService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test("code here", async () => {
    console.log("Boilerplate starts");

    const data = await service.client.account.getAccount();

    console.log(data);
  });
});
