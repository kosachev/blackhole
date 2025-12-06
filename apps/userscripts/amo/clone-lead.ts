import { BACKEND_BASE_URL, CFV, contactId, deliveryType, responsibleId, tags } from "../common";
import { AMO } from "../../../src/amo/amo.constants";

type RequestCloneLead = {
  lead_id: number;
  contact_id?: string;
  responsible_id?: string;
  delivery_type?: string;
  index?: string;
  city?: string;
  street?: string;
  building?: string;
  flat?: string;
  pvz?: string;
  tags: number[];
};

export class CloneLead {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/clone_lead`;

  constructor(private lead_id: number) {
    console.debug("CLONE LEAD LOADED", lead_id);

    const toplist = $("div.card-fields__top-name-more").find("ul");
    if ($(toplist).find("li div#cloneLead").length === 0) {
      $(toplist).append(
        '<li class="button-input__context-menu__item  element__ "><div id="cloneLead" class="button-input__context-menu__item__inner"><span class="button-input__context-menu__item__icon-container">📑</span><span class="button-input__context-menu__item__text "> Клонировать сделку</span></div></li>',
      );
    }

    $("#cloneLead").on("click", () => this.sendRequest());
  }

  async sendRequest() {
    const delivery_type = deliveryType();

    const data: RequestCloneLead = {
      lead_id: this.lead_id,
      contact_id: contactId().val()?.toString() ?? "",
      responsible_id: responsibleId().val()?.toString() ?? "",
      delivery_type: delivery_type && delivery_type !== "Выбрать" ? delivery_type : "",
      index: CFV(AMO.CUSTOM_FIELD.INDEX).val()?.toString() ?? "",
      city: CFV(AMO.CUSTOM_FIELD.CITY).val()?.toString() ?? "",
      street: CFV(AMO.CUSTOM_FIELD.STREET).val()?.toString() ?? "",
      building: CFV(AMO.CUSTOM_FIELD.BUILDING).val()?.toString() ?? "",
      flat: CFV(AMO.CUSTOM_FIELD.FLAT).val()?.toString() ?? "",
      pvz: CFV(AMO.CUSTOM_FIELD.PVZ).val()?.toString() ?? "",
      tags: tags(),
    };

    console.debug("SEND DATA CLONE LEAD", data);

    try {
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw Error("CLONE LEAD ERROR, failed to get data from backend");
      }

      const result = await res.json();
      console.debug("CLONE LEAD SUCCESS", result, `/leads/detail/${result.id}`);
      window.location.href = `/leads/detail/${result.id}`;
    } catch (err) {
      console.error("CLONE LEAD ERROR", err);
    }
  }
}
