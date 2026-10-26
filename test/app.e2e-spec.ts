import { ConfigService } from "@nestjs/config";
import { spec } from "pactum";

import { describe, test, beforeAll, afterAll, expect } from "bun:test";

import { type INestApplication } from "@nestjs/common";
import { createTestApp } from "./helpers/create-test-app";

describe("App e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const result = await createTestApp();
    app = result.app;
    const config = result.moduleRef.get(ConfigService);
    config.set("DB_UI_PASSWORD_HASH", await Bun.password.hash("test-only-password"));
    config.set("DB_UI_TOKEN_SECRET", "test-only-signing-secret-with-32-bytes");

    await app.listen(process.env.PORT ?? 6969);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("DB UI", () => {
    test("requires authentication for KPI data", async () => {
      await spec().get(`http://localhost:${process.env.PORT}/web/db_ui/kpi`).expectStatus(401);
    });

    test("returns KPI data after login with caching disabled", async () => {
      const response = await spec()
        .post(`http://localhost:${process.env.PORT}/web/db_ui/login`)
        .withBody({ password: "test-only-password" })
        .expectStatus(200)
        .expectHeader("cache-control", "no-store");
      await spec()
        .get(`http://localhost:${process.env.PORT}/web/db_ui/kpi`)
        .withHeaders("Authorization", `Bearer ${response.body.token}`)
        .expectStatus(200)
        .expectHeader("cache-control", "no-store")
        .expectJson([]);
    });

    test("has no write route for KPI data", async () => {
      await spec()
        .post(`http://localhost:${process.env.PORT}/web/db_ui/kpi`)
        .withBody({ price: 999 })
        .expectStatus(404);
    });

    test("issues guest links that only read the manager's KPI rows", async () => {
      const login = await spec()
        .post(`http://localhost:${process.env.PORT}/web/db_ui/login`)
        .withBody({ password: "test-only-password" })
        .expectStatus(200);
      const guest = await spec()
        .post(`http://localhost:${process.env.PORT}/web/db_ui/guest`)
        .withHeaders("Authorization", `Bearer ${login.body.token}`)
        .withBody({ manager: "1109421", users: ["1109421", "Manager-1"], settings: null })
        .expectStatus(200);
      expect(guest.body.token).toStartWith("g1.");
      await spec()
        .get(`http://localhost:${process.env.PORT}/web/db_ui/kpi`)
        .withHeaders("Authorization", `Bearer ${guest.body.token}`)
        .expectStatus(200)
        .expectJson([]);
      await spec()
        .get(`http://localhost:${process.env.PORT}/web/db_ui/cdek-delta`)
        .withHeaders("Authorization", `Bearer ${guest.body.token}`)
        .expectStatus(403);
      await spec()
        .post(`http://localhost:${process.env.PORT}/web/db_ui/guest`)
        .withHeaders("Authorization", `Bearer ${guest.body.token}`)
        .withBody({ manager: "1109421", users: ["1109421"] })
        .expectStatus(403);
    });
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
