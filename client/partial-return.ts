import { BACKEND_BASE_URL, CFV } from "./utils";

type Good = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

export class ParialReturn {
  readonly CATALOG_ID = 3272;
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/partial_return`;

  constructor(private lead_id: number) {
    console.debug("PARTIAL RETURN LOADED", lead_id);
    const toplist = $("div.card-fields__top-name-more").find("ul");
    if ($(toplist).find("li div#splitLead").length === 0) {
      $(toplist).append(
        '<li class="button-input__context-menu__item  element__ "><div id="splitLead" class="button-input__context-menu__item__inner"><span class="button-input__context-menu__item__icon-container">⇌</span><span class="button-input__context-menu__item__text "> Частичная доставка</span></div></li>',
      );
    }
    $("#splitLead").on("click", async () => await this.render());
  }

  private async render() {
    $("body").css("overflow", "hidden").attr("data-body-fixed", 1);
    $("body").append(
      '<div id="modalSplitLead" class="modal modal-list"><div class="modal-scroller custom-scroll"><div class="modal-body" style="display: block; margin-top: -741.5px; margin-left: -265px;"><div class="modal-body__inner"><span class="modal-body__close"><span id="closeModalSplitLead" class="icon icon-modal-close"></span></span><h2 class="modal-body__caption head_2">⇌ Частичный возврат</h2><div id="goodsList"></div></div></div></div></div>',
    );
    $("head").append(
      '<style type="text/css">.split_li_sold { background: #CCFF66; } .split_li_return { background: #D5D8DB; } .split_li { margin: 3px; padding: 5px; border-radius: 5px; cursor: pointer; } .split_li_sold:before { content: "\u2705"; margin-right: 10px; } .split_li_return:before { content: "\u274C"; margin-right: 10px; }</style>',
    );
    $("div#goodsList").append(
      '<h2 class="head_2" id="headSold">Продажа</h2><ul id="goodsSold"></ul><hr><h2 class="head_2" id="headReturn">Возврат</h2><ul id="goodsReturn"></ul><hr><button id="splitButtonGo" type="button" class="button-input button-cancel"><span class="button-input-inner "><span class="button-input-inner__text">Отправить</span></span></button><button id="splitButtonCancel" type="button" class="button-input button-cancel"><span class="button-input-inner "><span class="button-input-inner__text">Отмена</span></span></button>',
    );
    $("#closeModalSplitLead").on("click", this.closeModalSplit);
    $("button#splitButtonCancel").on("click", this.closeModalSplit);
    $("button#splitButtonGo").on("click", async (el) => await this.sendPartialReturn(el));

    await this.getGoodsFromLead(this.lead_id);
  }

  private async getGoodsFromLead(lead_id: number) {
    try {
      const res = await fetch(
        `https://gerda.amocrm.ru/ajax/leads/${lead_id}/catalog/${this.CATALOG_ID}/elements?before_id=0&before_created_at=0&limit=50&with=catalog_element`,
      );
      const data = await res.json();
      for (const item of data._embedded.links) {
        const good = {
          id: item.to_entity_id,
          name: item._embedded.catalog_element.name,
          quantity: item.metadata.quantity,
          price: +item._embedded.catalog_element.custom_fields.find(
            (field) => field.code === "PRICE",
          )?.values[0].value,
        };
        this.addGoodToSold(good);
      }
      $("#modalSplitLead").on("click", "li.split_li", (el) => this.handleListClick(el));
    } catch (e) {
      console.error("ERROR", e);
      alert("Ошибка получения товаров из лида");
    }
  }

  private handleListClick(el: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>) {
    const goodtype = $(el.target).attr("class")!.indexOf("split_li_sold");
    $(el.target).remove();
    if (goodtype > -1) {
      this.addGoodToReturn({
        id: +$(el.target).attr("data-id")!,
        name: $(el.target).text(),
        quantity: +$(el.target).attr("data-quantity")!,
        price: +$(el.target).attr("data-price")!,
      });
    } else {
      this.addGoodToSold({
        id: +$(el.target).attr("data-id")!,
        name: $(el.target).text(),
        quantity: +$(el.target).attr("data-quantity")!,
        price: +$(el.target).attr("data-price")!,
      });
    }
  }

  private addGoodToSold(good: Good) {
    $("ul#goodsSold").append(
      `<li class="split_li split_li_sold" data-id="${good.id}" data-quantity="${good.quantity}" data-price="${good.price}">${good.name}</li>`,
    );
    this.splitCallsHead();
  }

  private addGoodToReturn(good: Good) {
    $("ul#goodsReturn").append(
      `<li class="split_li split_li_return" data-id="${good.id}" data-quantity="${good.quantity}" data-price="${good.price}">${good.name}</li>`,
    );
    this.splitCallsHead();
  }

  private splitCallsHead() {
    $("h2#headSold").text("Продажа: " + $("ul#goodsSold").children().length);
    $("h2#headReturn").text("Возврат: " + $("ul#goodsReturn").children().length);
    if ($("ul#goodsSold").children().length > 0 || $("ul#goodsReturn").children().length > 0) {
      $("button#splitButtonGo").attr("class", "button-input button-input_blue");
    } else {
      $("button#splitButtonGo").attr("class", "button-input button-cancel");
    }
  }

  private closeModalSplit() {
    $("body").attr("data-body-fixed", 0).attr("style", "");
    $("div#modalSplitLead").remove();
  }

  private async sendPartialReturn(
    el: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>,
  ) {
    if ($(el.currentTarget).attr("class") !== "button-input button-input_blue") {
      console.debug("NOT GO");
      return;
    }
    $(el.currentTarget).attr("class", "button-input button-cancel");

    const data = {
      lead_id: this.lead_id,
      contact_id: +$('input[name="ID"]').val()!,
      catalog_id: this.CATALOG_ID,
      custom_fields: [1366662, 1430854, 1454436, 1369856, 1369858, 1454432, 1454434].map(
        (id: number) => ({
          field_id: id,
          value: CFV(id).val(),
        }),
      ),
      sold: [] as Good[],
      return: [] as Good[],
    };

    $("ul#goodsSold")
      .find("li.split_li")
      .each((i, el) => {
        data.sold.push({
          id: +$(el).attr("data-id")!,
          name: $(el).text()!,
          quantity: +$(el).attr("data-quantity")!,
          price: +$(el).attr("data-price")!,
        });
      });

    $("ul#goodsReturn")
      .find("li")
      .each((i, el) => {
        data.return.push({
          id: +$(el).attr("data-id")!,
          name: $(el).text()!,
          quantity: +$(el).attr("data-quantity")!,
          price: +$(el).attr("data-price")!,
        });
      });

    console.debug("SEND PARTIAL RETURN DATA", data);

    const res = await fetch(this.BACKEND_URL, {
      method: "POST",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify(data),
    });

    try {
      $("div#modalSplitLead").html(
        `<div class="modal-scroller custom-scroll"><div class="modal-body" style="display: block; margin-top: -741.5px; margin-left: -265px;"><div class="modal-body__inner" style="text-align: center;"><h2 class="head_2" style="font-size: 18pt;">${
          res.ok ? "✔ УСПЕШНО" : "✘ ОШИБКА"
        }</h2></div></div></div>`,
      );
    } catch (err) {
      $("div#modalSplitLead").html(
        `<div class="modal-scroller custom-scroll"><div class="modal-body" style="display: block; margin-top: -741.5px; margin-left: -265px;"><div class="modal-body__inner" style="text-align: center;"><h2 class="head_2" style="font-size: 18pt;">✘ ОШИБКА</h2></div></div></div>`,
      );
      console.error("Field to send data to backend", err);
    }

    setTimeout(this.closeModalSplit, 1000);
  }
}
