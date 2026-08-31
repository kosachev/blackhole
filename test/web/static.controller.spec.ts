import { describe, expect, test } from "bun:test";
import type { ConfigService } from "@nestjs/config";

import { StaticController } from "../../src/web/static.controller";

describe("StaticController", () => {
  test("injects configured API keys into the PVZ map", () => {
    const config = {
      getOrThrow: (name: string) => {
        if (name === "YANDEX_TILES_API_KEY") return "test key/with spaces";
        if (name === "DADATA_API_KEY") return "dadata key/with spaces";
        throw new Error(`Unexpected config key: ${name}`);
      },
    } as ConfigService;

    const html = new StaticController(config).pvzHtml();

    expect(html).toContain("tiles.api-maps.yandex.ru/v1/tiles/");
    expect(html).toContain("test%20key%2Fwith%20spaces");
    expect(html).toContain("suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address");
    expect(html).toContain('decodeURIComponent("dadata%20key%2Fwith%20spaces")');
    expect(html).toContain("const center = map.getCenter()");
    expect(html).toContain("locations_geo");
    expect(html).toContain("L.circleMarker(coords");
    expect(html).toContain('fillColor: "#d71920"');
    expect(html).not.toContain("__YANDEX_TILES_API_KEY__");
    expect(html).not.toContain("__DADATA_API_KEY__");
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
