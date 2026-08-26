import { Controller, Get, UseFilters, Header } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GlobalExceptionFilter } from "../utils/global-exception.filter";

import pvz from "../../public/pvz.html" with { type: "text" };
import yandex_logo_ru from "../../public/yandex_logo_ru.svg" with { type: "text" };
import gerda_userscript from "../../public/gerda_userscript.js" with { type: "text" };
import gerdacollection_userscript from "../../public/gerdacollection_userscript.js" with { type: "text" };
import shop_userscript from "../../public/shop_userscript.js" with { type: "text" };

@Controller("public")
@UseFilters(GlobalExceptionFilter)
export class StaticController {
  constructor(private readonly config: ConfigService) {}

  @Get("pvz.html")
  @Header("Content-Type", "text/html")
  pvzHtml(): string {
    const yandexTilesApiKey = encodeURIComponent(
      this.config.getOrThrow<string>("YANDEX_TILES_API_KEY"),
    );
    // @ts-expect-error pvz is a string because of with
    return pvz.replace("__YANDEX_TILES_API_KEY__", yandexTilesApiKey);
  }

  @Get("yandex_logo_ru.svg")
  @Header("Content-Type", "image/svg+xml")
  yandexLogoRu(): string {
    return yandex_logo_ru;
  }

  @Get("gerda_userscript.js")
  @Header("Content-Type", "text/javascript")
  gerdaUserscript(): string {
    // @ts-expect-error gerda_userscript is a string because of with
    return gerda_userscript;
  }

  @Get("gerdacollection_userscript.js")
  @Header("Content-Type", "text/javascript")
  gerdacollectionUserscript(): string {
    // @ts-expect-error gerdacollection_userscript is a string because of with
    return gerdacollection_userscript;
  }

  @Get("shop_userscript.js")
  @Header("Content-Type", "text/javascript")
  shopUserscript(): string {
    // @ts-expect-error shop_userscript is a string because of with
    return shop_userscript;
  }
}
