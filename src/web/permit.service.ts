import puppeteer from "puppeteer";
import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { AmoService } from "../amo/amo.service";
import { ConfigService } from "@nestjs/config";

export type RequestPermit = {
  lead_id: number;
  date: string; // YYYY-MM-DD
  first: string;
  middle: string;
  last: string;
};

@Injectable()
export class PermitService {
  protected readonly logger: Logger = new Logger(PermitService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly amo: AmoService,
  ) {}

  async handler(data: RequestPermit) {
    try {
      await this.permit(data);

      await this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: {
            text: `✅ Пропуск: Пропуск заказан для ${data.last} ${data.first} ${data.middle} на ${data.date}`,
          },
        },
      ]);
      this.logger.log(`USERSCRIPT_PERMIT, lead_id: ${data.lead_id}, date: ${data.date}`);
    } catch (e) {
      await this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: {
            text: `❌ Пропуск: Не удалось заказать пропуск для ${data.last} ${data.first} ${data.middle} на ${data.date}`,
          },
        },
      ]);

      this.logger.error(`USERSCRIPT_PERMIT, lead_id: ${data.lead_id}, date: ${data.date}`);
      throw new InternalServerErrorException(e);
    }
  }

  async permit({ lead_id: _, date, first, middle, last }: RequestPermit): Promise<void> {
    const [year, month, day] = date.split("-");
    const noon = new Date(+year, +month - 1, +day, 12).getTime();
    const browser = await puppeteer.launch({
      headless: true,
    }); // TODO: insetigate more option to make it slimier
    const page = await browser.newPage();
    await page.authenticate({
      username: this.config.get<string>("PERMIT_LOGIN"),
      password: this.config.get<string>("PERMIT_PASSWORD"),
    });

    await page.setViewport({ width: 1080, height: 1024 });
    await page.goto("https://2an.ru/new_order.aspx");

    // disable ad
    await page.waitForSelector("#ctl00_NotifDialog_btnClose_CD");
    await page.click("#ctl00_NotifDialog_btnClose_CD");

    // next month case
    if (+month - 1 > new Date().getMonth()) {
      await page.mouse.move(499, 499);
      await page.waitForSelector('a[class="datepick-cmd datepick-cmd-next "]');
      await page.click('a[class="datepick-cmd datepick-cmd-next "]');
    }

    // pick date
    await page.mouse.move(550, 450);
    await page.waitForSelector(`a.dp${noon}`);
    await page.click(`a.dp${noon}`);

    // fill form
    await page.focus("input#ctl00_PageContent_TbxFirstName_I");
    await page.keyboard.type(last);
    await page.focus("input#ctl00_PageContent_TbxSecondName_I");
    await page.keyboard.type(first);
    await page.focus("input#ctl00_PageContent_TbxMiddleName_I");
    await page.keyboard.type(middle);
    await page.$eval(
      "input#ctl00_PageContent_CmbPassType_I",
      (el) => (el.value = "разовый пропуск на посетителя"),
    );
    await page.$eval("input#ctl00_PageContent_CmbPersonType_I", (el) => (el.value = "посетитель"));

    // submit
    await page.click("input#ctl00_PageContent_btnAddOrder");
    await browser.close();
  }
}
