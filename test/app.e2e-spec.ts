import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { INestApplication } from "@nestjs/common";
import * as pactum from "pactum";

describe("App e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module_ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module_ref.createNestApplication();

    await app.init();
    await app.listen(process.env.PORT ?? 6969);
  });

  afterAll(async () => {
    await app.close();
  });

  it.todo("should pass");

  describe("CDEK", () => {
    describe("webhook", () => {
      const test_order = {
        type: "ORDER_STATUS",
        date_time: "2020-08-10T21:32:14+0700",
        uuid: "72753031-2801-4186-a091-0be58cedfee7",
        attributes: {
          is_return: false,
          cdek_number: "1106321645",
          code: "RECEIVED_AT_SHIPMENT_WAREHOUSE ",
          status_code: "3",
          status_date_time: "2020-08-10T21:32:12+0700",
          city_name: "Новосибирск",
          city_code: "270",
        },
      };
      it("should return 201", () => {
        return pactum
          .spec()
          .post("http://localhost:6969/cdek/webhook")
          .withBody(test_order)
          .expectStatus(201);
      });
    });
  });

  describe("AMO", () => {
    describe("webhook", () => {
      it("should return 201", () => {
        const test_task = {
          task: {
            update: [
              {
                id: 11122233,
                element_id: 33322211,
                element_type: 2,
                task_type: 1,
                date_create: "2017-07-20 15:00:00",
                text: "Follow-up",
                status: 1,
                account_id: 77711122,
                created_user_id: 123123,
                last_modified: "2017-07-21 19:00:00",
                responsible_user_id: 123123,
                complete_till: "2017-07-22 23:59:00",
                action_close: 1,
                result: {
                  id: 155155155,
                  text: "Success",
                },
              },
            ],
          },
          account: {
            subdomain: "test",
          },
        };

        return pactum
          .spec()
          .post("http://localhost:6969/amo/webhook")
          .withBody(test_task)
          .expectStatus(201);
      });
    });
  });
});
