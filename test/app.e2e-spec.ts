import * as pactum from "pactum";

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { mock_server } from "./mocks/mock-server";

describe("App e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module_ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module_ref.createNestApplication();

    await app.init();
    await Promise.all([mock_server.listen(), app.listen(process.env.PORT ?? 6969)]);
  });

  afterAll(async () => {
    await app.close();
    await Promise.all([mock_server.close(), app.close()]);
  });

  describe("CDEK", () => {
    describe("webhook", () => {
      test("should return 201", () => {
        return pactum
          .spec()
          .post(`http://localhost:${process.env.PORT}/cdek/webhook`)
          .expectStatus(201);
      });
    });
  });

  describe("AMO", () => {
    describe("lead-add", () => {
      test("should return 201", () => {
        expect(() =>
          pactum.spec().post(`http://localhost:${process.env.PORT}/amo/lead-add`).expectStatus(201),
        );
      });
    });
  });
});
