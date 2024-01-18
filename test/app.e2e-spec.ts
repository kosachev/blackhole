import * as pactum from "pactum";

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { mock_server } from "./mocks/mock-server";
import { task } from "./mocks/amo.mock";
import { order_status } from "./mocks/cdek.mock";

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
      it("should return 201", () => {
        return pactum
          .spec()
          .post(`http://localhost:${process.env.PORT}/cdek/webhook`)
          .withBody(order_status)
          .expectStatus(201);
      });
    });
  });

  describe("AMO", () => {
    describe("webhook", () => {
      it("should return 201", () => {
        return pactum
          .spec()
          .post(`http://localhost:${process.env.PORT}/amo/webhook`)
          .withBody(task)
          .expectStatus(201);
      });
    });
  });
});
