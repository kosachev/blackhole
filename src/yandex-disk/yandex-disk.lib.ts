export class YandexDiskClient {
  private readonly base_url = `https://cloud-api.yandex.net:443/v1/disk/resources`;

  constructor(private readonly token: string) {}

  private async request<T>(
    url: string,
    params: Record<string, string>,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  ): Promise<T> {
    const res = await fetch(`${this.base_url}${url}?${new URLSearchParams(params)}`, {
      method: method,
      headers: {
        Accept: "application/json",
        Authorization: `OAuth ${this.token}`,
      },
    });
    return res.json();
  }

  async getUploadUrl(path: string): Promise<string> {
    const res = await this.request<{ href: string }>("/upload", {
      path: `${path}`,
      fields: "href",
      overwrite: "true",
    });
    return res.href;
  }

  async uploadFile(url: string, data: Buffer) {
    await fetch(url, {
      method: "PUT",
      body: data,
    });
  }

  async getFileUrl(path: string): Promise<string> {
    const res = await this.request<{ href: string }>("/download", {
      path: `${path}`,
      fields: "href",
    });
    return res.href;
  }

  async publishFile(path: string): Promise<string> {
    await this.request<{ href: string }>(
      "/publish",
      {
        path: `${path}`,
        fields: "href",
      },
      "PUT",
    );
    const res = await this.request<{ public_url: string }>("", {
      path: `${path}`,
    });
    return res.public_url;
  }
}
