export class YandexDiskError extends Error {}

export class YandexDiskClient {
  private readonly BASE_URL = `https://cloud-api.yandex.net:443/v1/disk`;

  constructor(
    private readonly token: string,
    private readonly on_error?: (error: YandexDiskError) => void | Promise<void>,
  ) {}

  private async request<T>(
    url: string,
    params: Record<string, string>,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  ): Promise<T> {
    try {
      const res = await fetch(`${this.BASE_URL}${url}?${new URLSearchParams(params)}`, {
        method: method,
        headers: {
          Accept: "application/json",
          Authorization: `OAuth ${this.token}`,
        },
      });
      return res.json();
    } catch (error) {
      const err = new YandexDiskError(`API request fialure: ${error.message}`);
      if (this.on_error) {
        this.on_error(err);
        return null as T;
      } else {
        throw err;
      }
    }
  }

  async getUploadUrl(path: string): Promise<string> {
    const res = await this.request<{ href: string }>("/resources/upload", {
      path: `${path}`,
      fields: "href",
      overwrite: "true",
    });
    return res.href;
  }

  async uploadFile(url: string, data: Buffer) {
    try {
      await fetch(url, {
        method: "PUT",
        body: data,
      });
    } catch (error) {
      const err = new YandexDiskError(`API request fialure: ${error.message}`);
      if (this.on_error) {
        this.on_error(err);
      } else {
        throw err;
      }
    }
  }

  async getFileUrl(path: string): Promise<string> {
    const res = await this.request<{ href: string }>("/resources/download", {
      path: `${path}`,
      fields: "href",
    });
    return res.href;
  }

  async publishFile(path: string): Promise<string> {
    await this.request<{ href: string }>(
      "/resources/publish",
      {
        path: `${path}`,
        fields: "href",
      },
      "PUT",
    );
    const res = await this.request<{ public_url: string }>("/resources", {
      path: `${path}`,
    });
    return res.public_url;
  }

  async getPublicFileUrl(public_url: string) {
    const res = await this.request<{ href: string }>("/public/resources/download", {
      public_key: `${public_url}`,
    });
    return res;
  }
}
