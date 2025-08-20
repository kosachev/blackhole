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

    const body = `------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="__EVENTTARGET"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="__EVENTARGUMENT"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CropImg_url"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_FilePhoto_ClientState"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_FileScan_ClientState"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="__VIEWSTATE"

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KR8FAgIfCWUfCmcUKwABFggfAQVF0L7RgiAxMCDQtNC+IDIwINGCLiAo0LrRgNGD0L/QvdC+0YLQvtC90L3QsNC20L3Ri9C5INCz0YDRg9C30L7QstC40LopHwUCAx8JZR8KZxQrAAEWCB8BBRzRgdCy0YvRiNC1IDIwINGCLiAo0YTRg9GA0LApHwUCBB8JZR8KZ2RkZGQCdQ9kFgJmD2QWBAIDDw8WAh8JZWRkAgsPZBYCAgEPZBYCZg8WBB4CaWQFIWN0bDAwX1BhZ2VDb250ZW50X0ZpbGVQaG90b19jdGwwMh4Fc3R5bGUFDHdpZHRoOjI1MHB4O2QCdw9kFgJmD2QWAgIBD2QWAgIBD2QWAmYPFgQfDQUgY3RsMDBfUGFnZUNvbnRlbnRfRmlsZVNjYW5fY3RsMDIfDgUMd2lkdGg6MzA2cHg7ZAJ5DzwrAAUBAA8WBB8FBRFpbmZvQGdlcmRhLm1zay5ydR8DZ2RkAn8PPCsABQEADxYEHwUFDzcoNDk1KTk5NS01OC0yOB8DZ2RkAoMBDzwrABEDAA8WBB4LXyFEYXRhQm91bmRnHgtfIUl0ZW1Db3VudGZkARAWABYAFgAMFCsAAGQCiwEPD2QPEBYBZhYBFgIfDGQWAQIDZGQCBQ9kFgICAQ9kFgICAw9kFgYCAQ8PFgIfAQUHKzcgNDk1IGRkAgMPDxYCHwEFCDY2NS01ODYzZGQCBQ8PFgIfAQU00KPQn9Cg0JDQktCb0K/QrtCp0JDQryDQmtCe0JzQn9CQ0J3QmNCvINCf0J7QnNCe0KnQrGRkGAIFHl9fQ29udHJvbHNSZXF1aXJlUG9zdEJhY2tLZXlfXxYPBSFjdGwwMCRQYWdlQ29udGVudCRDbWJQYXNzVHlwZSREREQFI2N0bDAwJFBhZ2VDb250ZW50JENtYlBlcnNvblR5cGUkREREBSJjdGwwMCRQYWdlQ29udGVudCREYnhCaXJ0aERhdGUkREREBShjdGwwMCRQYWdlQ29udGVudCREYnhCaXJ0aERhdGUkREREJEMkRk5QBSBjdGwwMCRQYWdlQ29udGVudCRDbWJEb2NUeXBlJERERAUgY3RsMDAkUGFnZUNvbnRlbnQkVGJ4RG9jRGF0ZSREREQFJmN0bDAwJFBhZ2VDb250ZW50JFRieERvY0RhdGUkREREJEMkRk5QBSNjdGwwMCRQYWdlQ29udGVudCRDbWJBY2Nlc3NUeXBlJERERAUdY3RsMDAkUGFnZUNvbnRlbnQkQ21iTWFyayREREQFJmN0bDAwJFBhZ2VDb250ZW50JENtYkNhck51bWJlclR5cGUkREREBSBjdGwwMCRQYWdlQ29udGVudCRDbWJDYXJUeXBlJERERAUiY3RsMDAkUGFnZUNvbnRlbnQkQ21iQ2FyV2VpZ2h0JERERAUbY3RsMDAkUGFnZUNvbnRlbnQkRmlsZVBob3RvBRpjdGwwMCRQYWdlQ29udGVudCRGaWxlU2NhbgUwY3RsMDAkUGFnZUNvbnRlbnQkR3ZQYXNzZW5nZXJzJGN0bDAyJGNtZEFkZEVtcHR5BR5jdGwwMCRQYWdlQ29udGVudCRHdlBhc3NlbmdlcnMPPCsADAEIZmRr/O2FzXd9f6uUGVlWiVj8sOwUdV6TYw/4UVDRuF9RjQ==
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="__VIEWSTATEGENERATOR"

9B8E9023
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="__SCROLLPOSITIONX"

0
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="__SCROLLPOSITIONY"

0
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$HfPassType"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$HfUserComplex"

8
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$HfUserEppCustomer"

0
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$HfSelectedDates"

${day}.${month}.${year}
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxFirstName"

${last}
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxSecondName"

${first}
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxMiddleName"

${middle}
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_VI"

2
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbPassType"

разовый пропуск на посетителя
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_DDDWS"

0:0:12000:557:659:0:-10000:-10000
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_DDD_LDeletedItems"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_DDD_LInsertedItems"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbPassType_DDD_LCustomCallback"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbPassType$DDD$L"

2
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxBuilding"

11
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxFloor"

2
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxOffice"

203
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxWay"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbPersonType_VI"

2
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbPersonType"

посетитель
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbPersonType_DDDWS"

0:0:12000:557:890:0:-10000:-10000
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbPersonType$DDD$L"

2
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_DbxBirthDate_Raw"

N
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$DbxBirthDate"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_DbxBirthDate_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_DbxBirthDate_DDD_C_FNPWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$DbxBirthDate$DDD$C"

08/20/2025
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbDocType_VI"

0
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbDocType"

---выберите---
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbDocType_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbDocType$DDD$L"

0
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocSeriya"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocNumber"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocOrg"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_TbxDocDate_Raw"

N
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocDate"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_TbxDocDate_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_TbxDocDate_DDD_C_FNPWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocDate$DDD$C"

08/20/2025
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxDocAddress"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_VI"

1012
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbAccessType"

- категория отсутствует -
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_DDD_LDeletedItems"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_DDD_LInsertedItems"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbAccessType_DDD_LCustomCallback"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbAccessType$DDD$L"

1012
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxAccessDescription"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbMark_VI"

0
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbMark"

- нет -
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbMark_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbMark$DDD$L"

0
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxMarkDescription"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxCarMark"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarNumberType_VI"

RUS
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarNumberType"

Российский
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarNumberType_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarNumberType$DDD$L"

RUS
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxCarNumber"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_VI"

2
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarType"

Легковой
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_DDD_LDeletedItems"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_DDD_LInsertedItems"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarType_DDD_LCustomCallback"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarType$DDD$L"

2
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarWeight_VI"

0
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarWeight"

-- Выберите --
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00_PageContent_CmbCarWeight_DDDWS"

0:0:-1:0:0:0:0:0:
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$CmbCarWeight$DDD$L"

0
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$FilePhoto$ctl00"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$FilePhoto$ctl02"; filename=""
Content-Type: application/octet-stream


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$FileScan$ctl00"


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$FileScan$ctl02"; filename=""
Content-Type: application/octet-stream


------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxEmail"

info@gerda.msk.ru
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$TbxPhone"

7(495)995-58-28
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="ctl00$PageContent$btnAddOrder"

Добавить заявку
------WebKitFormBoundary7vxzlQ0hKVjjh5rw
Content-Disposition: form-data; name="DXScript"

1_49,2_14,2_13,2_8,1_46,1_29,2_11,1_42,2_7
------WebKitFormBoundary7vxzlQ0hKVjjh5rw--`;

    const session_id = await this.getSessionId();

    const res = await fetch("https://2an.ru/new_order.aspx", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Cookie: session_id,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        Authorization: this.auth,
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Length": Buffer.byteLength(body).toString(),
        "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundary7vxzlQ0hKVjjh5rw",
        Host: "2an.ru",
        Origin: "https://2an.ru",
        Pragma: "no-cache",
        Referer: "https://2an.ru/new_order.aspx",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Sec-GPC": "1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
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
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: this.auth,
      },
    });

    return main.headers.getSetCookie()[0].split(";")[0];
  }
}
