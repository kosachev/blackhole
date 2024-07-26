import { AMO } from "../src/amo/amo.constants";
import {
  BACKEND_BASE_URL,
  CFV,
  deliveryTariff,
  deliveryType,
  leadGoods,
  validateIndexCf,
} from "./common";

export class DeliveryPrice {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/delivery_price`;

  constructor(private lead_id: number) {
    console.debug("DELIVERY CALCULATOR LOADED", lead_id);

    $(`div[data-id=${AMO.CUSTOM_FIELD.DELIVERY_COST}] > div`)
      .first()
      .append(`<span id="delivery_price" style="margin-left: 5px; cursor: pointer">⟳</span>`);

    $("head").append(
      `<style class="delivery_price_style" type="text/css">.delivery_price_loading { animation: rotate 4s infinite; } @keyframes rotate { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) }</style>`,
    );

    CFV(AMO.CUSTOM_FIELD.INDEX).on("input", this.render);
    CFV(AMO.CUSTOM_FIELD.DELIVERY_TYPE).on("change", this.render);
    $("#delivery_price").on("click", () => this.sendRequest());

    this.render();
  }

  destructor() {
    console.debug("CKED PICKUP DESTRUCTOR", this.lead_id);
    CFV(AMO.CUSTOM_FIELD.INDEX).off("input");
    CFV(AMO.CUSTOM_FIELD.DELIVERY_TYPE).off("change");
    $("#delivery_price").off("click");
    $("head").find("style.delivery_price_style").remove();
  }

  render() {
    const delivery_type = deliveryType();

    if (
      (delivery_type === "Экспресс по России" || delivery_type === "Почта России") &&
      validateIndexCf()
    ) {
      $("#delivery_price").css("display", "inherit");
    } else {
      $("#delivery_price").css("display", "none").css("color", "");
    }
  }

  async sendRequest() {
    if ($("#delivery_price").hasClass("delivery_price_loading")) return;
    $("#delivery_price").addClass("delivery_price_loading");

    const data = {
      lead_id: this.lead_id,
      price: +$('input[name="lead[PRICE]"]').attr("value"),
      goods: await leadGoods(this.lead_id),
      index: CFV(AMO.CUSTOM_FIELD.INDEX).val() as string,
      delivery_type: deliveryType(),
      delivery_tariff: deliveryTariff(),
    };

    console.debug("SEND DELIVERY PRICE REQUEST", data);

    const res = await fetch(this.BACKEND_URL, {
      method: "POST",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      $("#delivery_price").css("color", "red").removeClass("delivery_price_loading");
    } else {
      $("#delivery_price").css("color", "green").removeClass("delivery_price_loading");
    }

    setTimeout(() => $("#delivery_price").css("color", ""), 3000);
  }
}
