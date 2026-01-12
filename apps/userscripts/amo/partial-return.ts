import { AMO } from "../../../src/amo/amo.constants";
import { BACKEND_BASE_URL, CFV, leadGoods } from "../common";

type Good = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};
import { Plugin } from "./plugin";
import { Modal } from "./modal";

export class ParialReturn extends Plugin {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/partial_return`;
  private modal: Modal;

  constructor(lead_id: number) {
    super(lead_id);
    console.debug("PARTIAL RETURN LOADED", lead_id);
    this.modal = new Modal("ParialReturn", {
      title: "⇌ Частичный возврат",
      width: 500,
    });
    this.addTopListButton({
      id: "splitLead",
      icon: "⇌",
      text: "Частичная доставка",
      onClick: async () => await this.render(),
    });
  }

  destructor() {
    console.debug("PARTIAL RETURN DESTRUCTOR", this.lead_id);
    this.modal.close();
  }

  style() {
    return '.split_li_sold { background: #CCFF66; } .split_li_return { background: #D5D8DB; } .split_li { margin: 3px; padding: 5px; border-radius: 5px; cursor: pointer; } .split_li_sold:before { content: "✅"; margin-right: 10px; } .split_li_return:before { content: "❌"; margin-right: 10px; }';
  }

  private async render() {
    // Content structure
    const content = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="column">
          <h2 class="head_2" id="headSold" style="font-size: 16px; margin-bottom: 10px; color: #555;">Продажа</h2>
          <ul id="goodsSold" class="goods-list" style="min-height: 100px; border: 1px solid #eee; border-radius: 6px; padding: 10px;"></ul>
        </div>
        <div class="column">
          <h2 class="head_2" id="headReturn" style="font-size: 16px; margin-bottom: 10px; color: #555;">Возврат</h2>
          <ul id="goodsReturn" class="goods-list" style="min-height: 100px; border: 1px solid #eee; border-radius: 6px; padding: 10px;"></ul>
        </div>
      </div>
    `;

    this.modal.create(content);

    this.modal.inner.append(`
      <div class="modal-footer">
        <button id="splitButtonCancel" type="button" class="btn btn-default">
          Отмена
        </button>
        <button id="splitButtonGo" type="button" class="btn btn-disabled">
          Отправить
        </button>
      </div>
    `);

    $("#splitButtonCancel").on("click", () => this.modal.close());
    $("button#splitButtonGo").on("click", async (el) => await this.sendPartialReturn(el));

    await this.getGoodsFromLead(this.lead_id);
  }

  private async getGoodsFromLead(lead_id: number) {
    try {
      this.modal.loading = true;
      const goods = await leadGoods(lead_id);
      this.modal.loading = false;
      goods.forEach((good) => this.addGoodToSold(good));
      this.modal.inner.on("click", "li.split_li", (el) => this.handleListClick(el));
    } catch (e) {
      this.modal.loading = false;
      console.error("ERROR", e);
      this.modal.error("Ошибка получения товаров из лида");
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
      $("button#splitButtonGo").attr("class", "btn btn-primary");
    } else {
      $("button#splitButtonGo").attr("class", "btn btn-disabled");
    }
  }


  private async sendPartialReturn(
    el: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>,
  ) {
    if ($(el.currentTarget).hasClass("btn-disabled")) {
      console.debug("NOT GO");
      return;
    }
    $(el.currentTarget).attr("class", "btn btn-disabled");

    const data = {
      lead_id: this.lead_id,
      contact_id: +$('input[name="ID"]').val()!,
      catalog_id: AMO.CATALOG.GOODS,
      custom_fields: [
        AMO.CUSTOM_FIELD.ORDER_ID,
        AMO.CUSTOM_FIELD.TRACK_NUMBER,
        AMO.CUSTOM_FIELD.INDEX,
        AMO.CUSTOM_FIELD.CITY,
        AMO.CUSTOM_FIELD.STREET,
        AMO.CUSTOM_FIELD.BUILDING,
        AMO.CUSTOM_FIELD.FLAT,
        AMO.CUSTOM_FIELD.CDEK_UUID,
      ].map((id: number) => ({
        field_id: id,
        value: CFV(id).val(),
      })),
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

    try {
      this.modal.loading = true;
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(data),
      });

      this.modal.loading = false;
      this.modal.operationResult(res.ok ? "✔ УСПЕШНО" : "✘ ОШИБКА");
    } catch (err) {
      this.modal.loading = false;
      this.modal.operationResult("✘ ОШИБКА");
      console.error("Field to send data to backend", err);
      setTimeout(() => this.modal.close(), 1000);
    }
  }
}
