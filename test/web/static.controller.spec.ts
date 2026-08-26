import { describe, expect, test } from "bun:test";
import type { ConfigService } from "@nestjs/config";

import { StaticController } from "../../src/web/static.controller";

describe("StaticController", () => {
  test("injects the configured Yandex Tiles API key into the PVZ map", () => {
    const config = {
      getOrThrow: (name: string) => {
        expect(name).toBe("YANDEX_TILES_API_KEY");
        return "test key/with spaces";
      },
    } as ConfigService;

    const html = new StaticController(config).pvzHtml();

    expect(html).toContain("tiles.api-maps.yandex.ru/v1/tiles/");
    expect(html).toContain("test%20key%2Fwith%20spaces");
    expect(html).not.toContain("__YANDEX_TILES_API_KEY__");
    expect(html).not.toContain("maps.api.2gis.ru");
    expect(html).not.toContain("nominatim.openstreetmap.org");
    expect(html).not.toContain("tile.openstreetmap.org");
  });

  test("serves the official Yandex map logo", () => {
    const controller = new StaticController({} as ConfigService);

    expect(controller.yandexLogoRu()).toContain("<svg");
    expect(controller.yandexLogoRu()).toContain("#FF0000");
  });
});
