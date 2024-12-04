import { AMO } from "../src/amo/amo.constants";
import { BACKEND_BASE_URL, CFV, deliveryType, validateIndexCf } from "./common";

export class PVZPicker {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/pvz_picker`;

  constructor(private lead_id: number) {
    console.debug("PVZ PICKER LOADED", lead_id);

    $(`div[data-id=${AMO.CUSTOM_FIELD.PVZ}] > div`)
      .first()
      .append(`<span id="pvz_picker" style="margin-left: 5px; cursor: pointer">⟳</span>`);

    $("head").append(
      `<style class="pvz_picker_style">#PVZPickerInner { height: 100vh } .pvz_picker_loading { animation: rotate 4s infinite; } @keyframes rotate { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) }</style>`,
    );

    CFV(AMO.CUSTOM_FIELD.INDEX).on("input", this.render);
    CFV(AMO.CUSTOM_FIELD.DELIVERY_TYPE).on("change", this.render);
    $("#pvz_picker").on("click", () => this.modal());
    $(window).on("message", (event) => {
      // @ts-expect-error data should be there
      const data = event.originalEvent.data;
      if (data?.type === "choose_point") {
        console.debug("PVZ PICKER MESSAGE", data.data);
        this.sendRequest(data.data);
      }
      if (data?.type === "close_modal") {
        this.close();
      }
    });

    this.render();
  }

  destructor() {
    console.debug("PVZ PICKER DESTRUCTOR", this.lead_id);
    CFV(AMO.CUSTOM_FIELD.INDEX).off("input");
    CFV(AMO.CUSTOM_FIELD.DELIVERY_TYPE).off("change");
    $("#pvz_picker").off("click");
    $("head").find("style.pvz_picker_style").remove();
    $(window).off("message");
  }

  private render() {
    const delivery_type = deliveryType();

    if (delivery_type === "Экспресс по России" && validateIndexCf()) {
      $("#pvz_picker").css("display", "inherit");
    } else {
      $("#pvz_picker").css("display", "none").css("color", "");
    }
  }

  private modal() {
    let url = `${BACKEND_BASE_URL}/public/pvz.html?backend=${BACKEND_BASE_URL}&origin=${window.location.origin}&index=${CFV(AMO.CUSTOM_FIELD.INDEX).val()}`;
    const query = `${CFV(AMO.CUSTOM_FIELD.STREET).val()}, ${CFV(AMO.CUSTOM_FIELD.BUILDING).val()}`;

    if (
      CFV(AMO.CUSTOM_FIELD.STREET).val() &&
      CFV(AMO.CUSTOM_FIELD.BUILDING).val() &&
      query.length > 3
    ) {
      url += `&query=${query}`;
    }

    $("body").css("overflow", "hidden").attr("data-body-fixed", 1);
    $("body").append(
      `<div id="modalPVZPicker" class="modal modal-list"><div class="modal-body" style="position: fixed; display: block; top: 10%; left: 10%; margin-left: 0; margin-bottom: 0; width: 80%; height: 80%; padding: 0"><div id="PVZPickerInner"><iframe style="position: absolute; height: 100%; width: 100%; border: none" src="${url}"></iframe><div id="closeModalPVZPicker" >✖</div><style>#closeModalPVZPicker { position: absolute; top: 10px; right: 10px; z-index: 100; width: 20px; height: 20px; border-radius: 50%; border: 5px solid #3d3d3d; padding: 5px; color: rgb(78, 78, 78); background-image: linear-gradient(to bottom, #fff 0, #e0e0e0 100%); font-size: 22px; text-align: center; line-height: 20px; cursor: pointer; } #closeModalPVZPicker:hover { background-image: linear-gradient(to top, #fff 0, #e0e0e0 100%) }</style></div></div>`,
    );
    $("#closeModalPVZPicker").on("click", this.close);
  }

  private close() {
    $("body").attr("data-body-fixed", 0).attr("style", "");
    $("div#modalPVZPicker").remove();
  }

  async sendRequest(pvz: any) {
    try {
      const street = pvz.location.address.split(",")[0];

      const data = {
        lead_id: this.lead_id,
        code: pvz.code,
        index: pvz.location.postal_code,
        city: pvz.location.city,
        city_code: pvz.location.city_code,
        street: street.trim(),
        building: pvz.location.address.split(`${street},`)[1].trim(),
      };

      console.debug("SEND PVZ PICKER REQUEST", data);

      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        $("#pvz_picker").css("color", "red").removeClass("pvz_picker_loading");
      } else {
        $("#pvz_picker").css("color", "green").removeClass("pvz_picker_loading");
      }
    } catch (err) {
      console.error("Field to send data to backend", err);
    }

    this.close();

    setTimeout(() => $("#pvz_picker").css("color", ""), 3000);
  }
}
