import { spec } from "pactum";

import { describe, test, beforeAll, afterAll } from "bun:test";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { createAmoServiceMock } from "./mocks/amo.mock";
import { createCdekServiceMock } from "./mocks/cdek.mock";
import { createMailServiceMock } from "./mocks/mail.mock";
import { createGoogleSheetsServiceMock } from "./mocks/google-sheets.mock";
import { createYandexDiskServiceMock } from "./mocks/yadisk.mock";
import { AmoService } from "../src/amo/amo.service";
import { CdekService } from "../src/cdek/cdek.service";
import { MailService } from "../src/mail/mail.service";
import { GoogleSheetsService } from "../src/google-sheets/google-sheets.service";
import { YandexDiskService } from "../src/yandex-disk/yandex-disk.service";

describe("App e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRefBuilder = await Test.createTestingModule({
      imports: [AppModule],
    });

    moduleRefBuilder
      .overrideProvider(AmoService)
      .useValue(createAmoServiceMock())
      .overrideProvider(CdekService)
      .useValue(createCdekServiceMock())
      .overrideProvider(MailService)
      .useValue(createMailServiceMock())
      .overrideProvider(GoogleSheetsService)
      .useValue(createGoogleSheetsServiceMock())
      .overrideProvider(YandexDiskService)
      .useValue(createYandexDiskServiceMock());

    const moduleRef = await moduleRefBuilder.compile();

    app = moduleRef.createNestApplication();

    await app.init();
    await app.listen(process.env.PORT ?? 6969);
  });

  afterAll(async () => {
    await app.close();
  });

  // describe("CDEK", () => {
  //   describe("webhook", () => {
  //     test("should return 201 early", () => {
  //       return spec()
  //         .post(`http://localhost:${process.env.PORT}/cdek/webhook`)
  //         .withBody({
  //           type: "ORDER_STATUS",
  //           attributes: {
  //             is_return: false,
  //           },
  //         })
  //         .expectStatus(200)
  //         .expectBody("OK");
  //     });

  //     for (const sc of [1, 3, 4, 5, 6, 7, 10, 11, 12, 19]) {
  //       test(`should return 201 for ${sc}/20`, () => {
  //         return spec()
  //           .post(`http://localhost:${process.env.PORT}/cdek/webhook`)
  //           .withBody({
  //             type: "ORDER_STATUS",
  //             date_time: "2020-09-07T16:24:56+0700",
  //             uuid: "72753031-01e2-434f-b5a8-a4dbb3278101",
  //             attributes: {
  //               is_return: false,
  //               cdek_number: "1197739374",
  //               number: "31045357",
  //               status_code: sc.toString(),
  //               status_reason_code: "20",
  //               status_date_time: "2020-09-07T16:24:56+0700",
  //               city_name: "Набережные Челны",
  //             },
  //           })
  //           .expectStatus(200)
  //           .expectBody("OK");
  //       });
  //     }

  //     for (const sc of [4, 5]) {
  //       for (const src of [15, undefined]) {
  //         test(`should return 201 for ${sc}/${src}`, () => {
  //           return spec()
  //             .post(`http://localhost:${process.env.PORT}/cdek/webhook`)
  //             .withBody({
  //               type: "ORDER_STATUS",
  //               date_time: "2020-09-07T16:24:56+0700",
  //               uuid: "72753031-01e2-434f-b5a8-a4dbb3278101",
  //               attributes: {
  //                 is_return: false,
  //                 cdek_number: "1197739374",
  //                 number: "31045357",
  //                 status_code: sc.toString(),
  //                 status_reason_code: src ? src.toString() : undefined,
  //                 status_date_time: "2020-09-07T16:24:56+0700",
  //                 city_name: "Набережные Челны",
  //               },
  //             })
  //             .expectStatus(200)
  //             .expectBody("OK");
  //         });
  //       }
  //     }
  //   });
  // });

  describe("AMO", () => {
    describe("lead-status", () => {
      test("should return 200, auto ok", async () => {
        await spec()
          .post(`http://localhost:${process.env.PORT}/amo/lead_status`)
          .expectStatus(200)
          .expectBody("OK");
      });
    });
  });
});
