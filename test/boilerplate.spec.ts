import { describe, test, beforeAll, afterAll } from "vitest";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { MailService } from "../src/mail/mail.service";
// import fs from "fs";

describe("CDEK OrderStatusWebhook", () => {
  let app: INestApplication;
  let service: MailService;

  // mockAmoService();
  // mockMailService();
  // mockGoogleSheetsService();

  beforeAll(async () => {
    const module_ref = await Test.createTestingModule({
      imports: [AppModule],
      providers: [MailService],
    }).compile();

    app = module_ref.createNestApplication();
    service = module_ref.get<MailService>(MailService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test("code here", async () => {
    console.log("Boilerplate starts");
    // await service.invoiceCdek({
    //   name: "Name",
    //   address: "Индекс, город, улица, дом, квартира",
    //   phone: "+7(916)324-56-78",
    //   email: "nayn@yandex.ru",
    //   deliveryType: "Экспресс по России",
    //   orderNumber: "23423",
    //   items:[
    //       {
    //         "name": "Куртка из вязаной норки 'Хлоя'",
    //         "quantity": 1,
    //         "price": 19900,
    //         "sum": 19900
    //       },
    //       {
    //         "name": "Шапка 'Норка'",
    //         "quantity": 2,
    //         "price": 7500,
    //         "sum": 15000
    //       }
    //     ],
    //   totalPrice: 34900,
    //   // discount: 5, // Необязательный параметр. Если не указан, то в шаблоне не отображается блок скидки
    //   discountedPrice: 34400, // Необязательный параметр
    //   prepayment: 800,
    // });

    await service.invoicePost({
      name: "Фамилия Имя Отчество",
      address: "Индекс, город, улица, дом, квартира",
      phone: "+7(916)324-56-78",
      email: "nayn@yandex.ru",
      deliveryType: "Почта России",
      orderNumber: "23423",
      items:[
          {
            "name": "Куртка из вязаной норки 'Хлоя'",
            "quantity": 1,
            "price": 19900,
            "sum": 19900
          },
          {
            "name": "Шапка 'Норка'",
            "quantity": 2,
            "price": 7500,
            "sum": 15000
          }
        ],
      totalPrice: 34900,
      discount: 5, // Необязательный параметр. Если не указан, то в шаблоне не отображается блок скидки
      discountedPrice: 34400, // Необязательный параметр
      prepayment: 1800, // Сумма предоплаты для почты всегда составляет 15% от стоимости товара с учетом скидки если она есть
    });
  });
});
