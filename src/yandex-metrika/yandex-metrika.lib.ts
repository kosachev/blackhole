export type CSVData =
  | {
      ClientId: string;
      Target: string;
      DateTime: number;
      Price: number;
      Currency: string;
    }
  | {
      Yclid: string;
      Target: string;
      DateTime: number;
      Price: number;
      Currency: string;
    };

export class YandexMetrikaError extends Error {}

export class YandexMetrikaClient {
  constructor(
    private readonly token: string,
    private readonly on_error?: (error: YandexMetrikaError) => void | Promise<void>,
  ) {}

  private async request(
    counter: number,
    client_id_type: "CLIENT_ID" | "YCLID",
    data: CSVData,
    comment?: string,
  ) {
    try {
      const boundary = "------------------------" + Math.random().toString(36).slice(2);

      let body = "";
      body += `--${boundary}\r\n`;
      body += 'Content-Disposition: form-data; name="file"; filename="data.csv"\r\n';
      body += "Content-Type: text/csv\r\n\r\n";
      body += Object.keys(data).join(",") + "\r\n";
      body += Object.values(data).join(",") + "\r\n";
      body += `--${boundary}--\r\n`;

      const url = `https://api-metrika.yandex.net/management/v1/counter/${counter}/offline_conversions/upload?client_id_type=${client_id_type}${
        comment ? "&comment=" + comment : ""
      }`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `OAuth ${this.token}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
      });

      if (!res.ok) {
        throw new YandexMetrikaError((await res.json()).message);
      }

      return await res.json();
    } catch (error) {
      const err = new YandexMetrikaError(error.message);
      if (this.on_error) {
        this.on_error(err);
        return null;
      } else {
        throw err;
      }
    }
  }

  async upload(counter: number, data: CSVData, comment?: string) {
    if (Object.hasOwn(data, "ClientId")) {
      return await this.request(counter, "CLIENT_ID", data, comment);
    } else if (Object.hasOwn(data, "Yclid")) {
      return await this.request(counter, "YCLID", data, comment);
    } else {
      throw new YandexMetrikaError("Invalid data");
    }
  }
}
