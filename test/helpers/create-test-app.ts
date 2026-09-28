import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { AmoService } from "../../src/amo/amo.service";
import { CdekService } from "../../src/cdek/cdek.service";
import { CdekWebhookCheckService } from "../../src/cdek/cdek-webhook-check.service";
import { DbService } from "../../src/db/db.service";
import { GoogleSheetsService } from "../../src/google-sheets/google-sheets.service";
import { MailService } from "../../src/mail/mail.service";
import { TelegramService } from "../../src/telegram/telegram.service";
import { DeliveryPriceService } from "../../src/web/delivery-price.service";
import { YandexDiskService } from "../../src/yandex-disk/yandex-disk.service";
import { createAmoServiceMock } from "../mocks/amo.mock";
import { createCdekServiceMock } from "../mocks/cdek.mock";
import { createDbServiceMock } from "../mocks/db.mock";
import { createGoogleSheetsServiceMock } from "../mocks/google-sheets.mock";
import { createMailServiceMock } from "../mocks/mail.mock";
import { createTelegramServiceMock } from "../mocks/telegram.mock";
import { createYandexDiskServiceMock } from "../mocks/yadisk.mock";

export async function createTestApp(
  overrides: {
    db?: DbService;
    googleSheets?: GoogleSheetsService;
  } = {},
): Promise<{
  app: INestApplication;
  moduleRef: TestingModule;
}> {
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
    .overrideProvider(DbService)
    .useValue(overrides.db ?? createDbServiceMock())
    .overrideProvider(GoogleSheetsService)
    .useValue(overrides.googleSheets ?? createGoogleSheetsServiceMock())
    .overrideProvider(YandexDiskService)
    .useValue(createYandexDiskServiceMock())
    .overrideProvider(TelegramService)
    .useValue(createTelegramServiceMock())
    // Plain object has no onModuleInit/@Cron, so boot-time network checks are
    // skipped. Neither provider is exercised by tests under test:all.
    .overrideProvider(CdekWebhookCheckService)
    .useValue({})
    .overrideProvider(DeliveryPriceService)
    .useValue({});

  const moduleRef = await moduleRefBuilder.compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return { app, moduleRef };
}
