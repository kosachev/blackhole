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
  private readonly auth: string;

  constructor(
    private readonly config: ConfigService,
    private readonly amo: AmoService,
  ) {
    this.auth = `Basic ${Buffer.from(`${config.get<string>("PERMIT_LOGIN")}:${config.get<string>("PERMIT_PASSWORD")}`).toString("base64")}`;
  }

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

    const body = `------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="__EVENTTARGET"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="__EVENTARGUMENT"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CropImg_url"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_FilePhoto_ClientState"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_FileScan_ClientState"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="__VIEWSTATE"

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Ah8JZWRkAgsPZBYCAgEPZBYCZg8WBB4CaWQFIWN0bDAwX1BhZ2VDb250ZW50X0ZpbGVQaG90b19jdGwwMh4Fc3R5bGUFDHdpZHRoOjI1MHB4O2QCdw9kFgJmD2QWAgIBD2QWAgIBD2QWAmYPFgQfDQUgY3RsMDBfUGFnZUNvbnRlbnRfRmlsZVNjYW5fY3RsMDIfDgUMd2lkdGg6MzA2cHg7ZAJ5DzwrAAUBAA8WBB8FBRFpbmZvQGdlcmRhLm1zay5ydR8DZ2RkAn8PPCsABQEADxYEHwUFDzcoNDk1KTk5NS01OC0yOB8DZ2RkAoMBDzwrABECAA8WBB4LXyFEYXRhQm91bmRnHgtfIUl0ZW1Db3VudGZkARAWABYAFgBkAosBDw9kDxAWAWYWARYCHwxkFgECA2RkAgUPZBYCAgEPZBYCAgMPZBYGAgEPDxYCHwEFBys3IDQ5NSBkZAIDDw8WAh8BBQg2NjUtNTg2M2RkAgUPDxYCHwEFONCj0L/RgNCw0LLQu9GP0Y7RidCw0Y8g0LrQvtC80L/QsNC90LjRjyAiTmV3IExpZmUgR3JvdXAiZGQYAgUeX19Db250cm9sc1JlcXVpcmVQb3N0QmFja0tleV9fFg8FIWN0bDAwJFBhZ2VDb250ZW50JENtYlBhc3NUeXBlJERERAUjY3RsMDAkUGFnZUNvbnRlbnQkQ21iUGVyc29uVHlwZSREREQFImN0bDAwJFBhZ2VDb250ZW50JERieEJpcnRoRGF0ZSREREQFKGN0bDAwJFBhZ2VDb250ZW50JERieEJpcnRoRGF0ZSREREQkQyRGTlAFIGN0bDAwJFBhZ2VDb250ZW50JENtYkRvY1R5cGUkREREBSBjdGwwMCRQYWdlQ29udGVudCRUYnhEb2NEYXRlJERERAUmY3RsMDAkUGFnZUNvbnRlbnQkVGJ4RG9jRGF0ZSREREQkQyRGTlAFI2N0bDAwJFBhZ2VDb250ZW50JENtYkFjY2Vzc1R5cGUkREREBR1jdGwwMCRQYWdlQ29udGVudCRDbWJNYXJrJERERAUmY3RsMDAkUGFnZUNvbnRlbnQkQ21iQ2FyTnVtYmVyVHlwZSREREQFIGN0bDAwJFBhZ2VDb250ZW50JENtYkNhclR5cGUkREREBSJjdGwwMCRQYWdlQ29udGVudCRDbWJDYXJXZWlnaHQkREREBRtjdGwwMCRQYWdlQ29udGVudCRGaWxlUGhvdG8FGmN0bDAwJFBhZ2VDb250ZW50JEZpbGVTY2FuBTBjdGwwMCRQYWdlQ29udGVudCRHdlBhc3NlbmdlcnMkY3RsMDIkY21kQWRkRW1wdHkFHmN0bDAwJFBhZ2VDb250ZW50JEd2UGFzc2VuZ2Vycw88KwAMAQhmZEvfWmdBuaBMdrCq718o8E4JiQ8axiWi6i75sxz6BfjF
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="__VIEWSTATEGENERATOR"

9B8E9023
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="__SCROLLPOSITIONX"

0
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="__SCROLLPOSITIONY"

0
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$HfPassType"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$HfUserComplex"

8
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$HfUserEppCustomer"

0
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$HfSelectedDates"

${day}.${month}.${year}
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxFirstName"

${last}
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxSecondName"

${first}
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxMiddleName"

${middle}
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_VI"

2
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbPassType"

разовый пропуск на посетителя
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_DDDWS"

0:0:12000:710:676:0:-10000:-10000
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_DDD_LDeletedItems"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_DDD_LInsertedItems"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_DDD_LCustomCallback"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbPassType$DDD$L"

2
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxBuilding"

11
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxFloor"

2
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxOffice"

203
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxWay"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbPersonType_VI"

2
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbPersonType"

посетитель
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbPersonType_DDDWS"

0:0:12000:710:907:0:-10000:-10000
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbPersonType$DDD$L"

2
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_DbxBirthDate_Raw"

N
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$DbxBirthDate"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_DbxBirthDate_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_DbxBirthDate_DDD_C_FNPWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$DbxBirthDate$DDD$C"

09/18/2024
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbDocType_VI"

0
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbDocType"

---выберите---
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbDocType_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbDocType$DDD$L"

0
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocSeriya"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocNumber"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocOrg"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_TbxDocDate_Raw"

N
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocDate"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_TbxDocDate_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_TbxDocDate_DDD_C_FNPWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocDate$DDD$C"

09/18/2024
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocAddress"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_VI"

1012
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbAccessType"

- категория отсутствует -
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_DDD_LDeletedItems"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_DDD_LInsertedItems"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_DDD_LCustomCallback"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbAccessType$DDD$L"

1012
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxAccessDescription"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbMark_VI"

0
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbMark"

- нет -
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbMark_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbMark$DDD$L"

0
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxMarkDescription"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxCarMark"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarNumberType_VI"

RUS
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarNumberType"

Российский
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarNumberType_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarNumberType$DDD$L"

RUS
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxCarNumber"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_VI"

2
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarType"

Легковой
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_DDD_LDeletedItems"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_DDD_LInsertedItems"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_DDD_LCustomCallback"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarType$DDD$L"

2
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarWeight_VI"

0
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarWeight"

-- Выберите --
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarWeight_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarWeight$DDD$L"

0
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$FilePhoto$ctl00"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$FilePhoto$ctl02"; filename=""
Content-Type: application/octet-stream


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$FileScan$ctl00"


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$FileScan$ctl02"; filename=""
Content-Type: application/octet-stream


------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxEmail"

info@gerda.msk.ru
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$TbxPhone"

7(495)995-58-28
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="ctl00$PageContent$btnAddOrder"

Добавить заявку
------WebKitFormBoundaryolIXo8aQkjWvudVf
Content-Disposition: form-data; name="DXScript"

1_49,2_14,2_13,2_8,1_46,1_29,2_11,1_42,2_7
------WebKitFormBoundaryolIXo8aQkjWvudVf--`;

    const session_id = await this.getSessionId();

    const res = await fetch("https://2an.ru/new_order.aspx", {
      method: "POST",
      headers: {
        Cookie: session_id,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "ru;q=0.5",
        Authorization: this.auth,
        "Cache-Control": "max-age=0",
        Connection: "keep-alive",
        "Content-Length": Buffer.byteLength(body).toString(),
        "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryolIXo8aQkjWvudVf",
        Host: "2an.ru",
        Origin: "https://2an.ru",
        Referer: "https://2an.ru/new_order.aspx",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Sec-GPC": "1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "sec-ch-ua": 'Not)A;Brand";v="99", "Brave";v="127", "Chromium";v="127"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "Windows",
      },
      body: body,
    });

    if (!res.ok) throw new Error("Failed to add permit");
  }

  private async getSessionId(): Promise<string> {
    const main = await fetch("https://2an.ru/", {
      method: "GET",
      headers: {
        Authorization: this.auth,
      },
    });

    return main.headers.getSetCookie()[0];
  }
}
