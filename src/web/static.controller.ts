import { Controller, Get, UseFilters, Header } from "@nestjs/common";
import { GlobalExceptionFilter } from "../utils/global-exception.filter";

import pvz from "../../public/pvz.html" with { type: "text" };
import gerda_userscript from "../../public/gerda_userscript.js" with { type: "text" };
import gerdacollection_userscript from "../../public/gerdacollection_userscript.js" with { type: "text" };
import shop_userscript from "../../public/shop_userscript.js" with { type: "text" };

@Controller("public")
@UseFilters(GlobalExceptionFilter)
export class StaticController {
  @Get("pvz.html")
  @Header("Content-Type", "text/html")
  pvzHtml(): string {
    // @ts-expect-error pvz is a string because of with
    return pvz;
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
