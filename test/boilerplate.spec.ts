import { describe, test, beforeAll, afterAll } from "vitest";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { AmoService } from "src/amo/amo.service";
import { AMO } from "src/amo/amo.constants";

describe("Boilerplate", () => {
  let app: INestApplication;
  let service: AmoService;

  // mockAmoService();
  // mockMailService();
  // mockGoogleSheetsService();

  beforeAll(async () => {
    const module_ref = await Test.createTestingModule({
      imports: [AppModule],
      providers: [AmoService],
    }).compile();

    app = module_ref.createNestApplication();
    service = module_ref.get<AmoService>(AmoService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test("code here", async () => {
    console.log("Boilerplate starts");

    const data = await service.client.salesbot.runTask([
      {
        bot_id: AMO.SALESBOT.ORDER_AT_PVZ,
        entity_type: 2,
        entity_id: 39525641,
      },
    ]);

    console.log(data);
  });
});
