import { describe, test, beforeAll, afterAll } from "vitest";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PDFService } from "../src/pdf/pdf.service";
import fs from "fs";

describe("CDEK OrderStatusWebhook", () => {
  let app: INestApplication;
  let service: PDFService;

  // mockAmoService();
  // mockMailService();
  // mockGoogleSheetsService();

  beforeAll(async () => {
    const module_ref = await Test.createTestingModule({
      imports: [AppModule],
      providers: [PDFService],
    }).compile();

    app = module_ref.createNestApplication();
    service = module_ref.get<PDFService>(PDFService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test("code here", async () => {
    console.log("Boilerplate starts");

    const data = await service.post7p({
      recipient: "ПРИВЕТ",
      recipient_address: "улица такая то",
      recipient_index: 12312,
      sum_insured: 124124,
      sum_cash_on_delivery: 1232,
    });

    fs.writeFileSync("./test.pdf", data);
  });
});
