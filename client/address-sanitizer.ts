import { AMO } from "../src/amo/amo.constants";
import { BACKEND_BASE_URL, CFV, setLeadFields } from "./common";

type Query = {
  lead_id: number;
  query: string;
};

type SanitizedAddress = {
  index: string;
  city: string;
  street: string;
  building: string;
  flat: string;
};

export class AddressSanitizer {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/address_sanitizer`;

  constructor(private lead_id: number) {
    console.debug("ADDRESS SANITIZER LOADED", lead_id);

    $(`div[data-id=${AMO.CUSTOM_FIELD.CITY}] > div`)
      .first()
      .append(`<span id="address_sanitizer" style="margin-left: 5px; cursor: pointer">⟳</span>`);

    $("head").append(/*html*/ `<style class="address_sanitizer_style" type="text/css">
        .address_sanitizer_table {
          display: grid;
          grid-template-columns: 80px 1fr 1fr;
          border: 0.8px solid #c5c5c5;
          width: 100%;
        }
        .address_sanitizer_cell {
          border: 0.8px solid #c5c5c5;
          padding: 6px;
          text-align: center;
        }
        .address_sanitizer_cell input {
          text-align: center;
        }
        @keyframes address_sanitizer_rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .address_sanitizer_loading {
          display: inline-block;
          animation: address_sanitizer_rotate 4s linear infinite;
        }
      </style>`);

    CFV(AMO.CUSTOM_FIELD.CITY).on("input", this.render);
    $("#address_sanitizer").on("click", async () => await this.modalCreate());
  }

  destructor() {
    console.debug("ADDRESS SANITIZER DESTRUCTOR", this.lead_id);

    $("head").find("style.address_sanitizer_style").remove();
    CFV(AMO.CUSTOM_FIELD.CITY).off("input");
  }

  render() {
    if (
      CFV(AMO.CUSTOM_FIELD.CITY).val() === "" ||
      CFV(AMO.CUSTOM_FIELD.CITY).val() === null ||
      CFV(AMO.CUSTOM_FIELD.CITY).val() === undefined
    ) {
      $("#address_sanitizer").css("display", "none").css("color", "");
    } else {
      $("#address_sanitizer").css("display", "inherit");
    }
  }

  async modalCreate() {
    $("body").css("overflow", "hidden").attr("data-body-fixed", 1);
    $("body").append(/*html*/ `
      <div id="modalAddressSanitizer" class="modal modal-list">
        <div class="modal-scroller custom-scroll">
          <div
            class="modal-body"
            style="display: block; top: 20%; left: calc(50% - 350px); margin-left: 0; margin-bottom: 0; width: 700px;"
          >
            <div class="modal-body__inner">
              <span class="modal-body__close">
                <span id="closeAddressSanitizer" class="icon icon-modal-close"></span>
              </span>
              <h2 class="modal-body__caption head_2">
                🚩 Разбор адреса
                <div class="address_sanitizer_loading">⏳</div>
                <div class="address_sanitizer_success" style="display: none;">✔</div>
                <div class="address_sanitizer_error" style="display: none;">✘</div>
              </h2>
              <div id="addressSanitizerInner">
                <div class="address_sanitizer_table">
                  <div class="address_sanitizer_cell">Индекс</div>
                  <div class="address_sanitizer_cell">
                    ${CFV(AMO.CUSTOM_FIELD.INDEX).val() ?? ""}
                  </div>
                  <div class="address_sanitizer_cell">
                    <input type="text" placeholder="..." id="address_sanitizer_index" />
                  </div>
                  <div class="address_sanitizer_cell">Город</div>
                  <div class="address_sanitizer_cell">
                    ${CFV(AMO.CUSTOM_FIELD.CITY).val() ?? ""}
                  </div>
                  <div class="address_sanitizer_cell">
                    <input type="text" placeholder="..." id="address_sanitizer_city" />
                  </div>
                  <div class="address_sanitizer_cell">Улица</div>
                  <div class="address_sanitizer_cell">
                    ${CFV(AMO.CUSTOM_FIELD.STREET).val() ?? ""}
                  </div>
                  <div class="address_sanitizer_cell">
                    <input type="text" placeholder="..." id="address_sanitizer_street" />
                  </div>
                  <div class="address_sanitizer_cell">Дом</div>
                  <div class="address_sanitizer_cell">
                    ${CFV(AMO.CUSTOM_FIELD.BUILDING).val() ?? ""}
                  </div>
                  <div class="address_sanitizer_cell">
                    <input type="text" placeholder="..." id="address_sanitizer_building" />
                  </div>
                  <div class="address_sanitizer_cell">Квартира</div>
                  <div class="address_sanitizer_cell">
                    ${CFV(AMO.CUSTOM_FIELD.FLAT).val() ?? ""}
                  </div>
                  <div class="address_sanitizer_cell">
                    <input type="text" placeholder="..." id="address_sanitizer_flat" />
                  </div>
                </div>
              </div>
              <br />
              <button
                id="addressSanitizerButtonGo"
                type="button"
                class="button-input button-cancel"
              >
                <span class="button-input-inner "
                  ><span class="button-input-inner__text">Обновить сделку</span></span
                ></button
              ><button
                id="addressSanitizerButtonCancel"
                type="button"
                class="button-input button-cancel"
              >
                <span class="button-input-inner "
                  ><span class="button-input-inner__text">Отмена</span></span
                >
              </button>
            </div>
          </div>
        </div>
      </div>
    `);

    $("#closeAddressSanitizer").on("click", () => this.modalClose());
    $("#addressSanitizerButtonCancel").on("click", () => this.modalClose());
    $("#addressSanitizerButtonGo").on("click", () => this.updateLeadData());
    $("#addressSanitizerInner input").on("input", () => this.validateData());

    await this.modalUpdate();
  }

  modalClose() {
    $("body").attr("data-body-fixed", 0).attr("style", "");
    $("#modalAddressSanitizer").remove();
  }

  async modalUpdate() {
    try {
      const { index, city, street, building, flat } = await this.sendRequest();
      $(".address_sanitizer_loading").css("display", "none");
      $(".address_sanitizer_success").css("display", "inline-block").css("color", "green");
      setTimeout(() => $(".address_sanitizer_success").css("display", "none"), 2000);

      $("#address_sanitizer_index").val(index);
      $("#address_sanitizer_city").val(city);
      $("#address_sanitizer_street").val(street);
      $("#address_sanitizer_building").val(building);
      $("#address_sanitizer_flat").val(flat);

      this.validateData();
    } catch (error) {
      $(".address_sanitizer_loading").css("display", "none");
      $(".address_sanitizer_error").css("display", "inline-block").css("color", "red");
      console.error("ADDRESS SANITIZER ERROR", error);
    }
  }

  validateData() {
    const index = $("#address_sanitizer_index").val() as string;
    const city = $("#address_sanitizer_city").val() as string;
    const street = $("#address_sanitizer_street").val() as string;
    const building = $("#address_sanitizer_building").val() as string;
    const flat = $("#address_sanitizer_flat").val() as string;

    if (
      (index && index.length > 0) ||
      (city && city.length > 0) ||
      (street && street.length > 0) ||
      (building && building.length > 0) ||
      (flat && flat.length > 0)
    ) {
      $("#addressSanitizerButtonGo").attr("class", "button-input button-input_blue");
    } else {
      $("#addressSanitizerButtonGo").attr("class", "button-input button-cancel");
    }
  }

  async updateLeadData() {
    if ($("#addressSanitizerButtonGo").attr("class") !== "button-input button-input_blue") {
      return;
    }
    $("#addressSanitizerButtonGo").attr("class", "button-input button-cancel");

    const index = $("#address_sanitizer_index").val() as string;
    const city = $("#address_sanitizer_city").val() as string;
    const street = $("#address_sanitizer_street").val() as string;
    const building = $("#address_sanitizer_building").val() as string;
    const flat = $("#address_sanitizer_flat").val() as string;

    const form = new FormData();
    form.append(`CFV[${AMO.CUSTOM_FIELD.INDEX}]`, index);
    form.append(`CFV[${AMO.CUSTOM_FIELD.CITY}]`, city);
    form.append(`CFV[${AMO.CUSTOM_FIELD.STREET}]`, street);
    form.append(`CFV[${AMO.CUSTOM_FIELD.BUILDING}]`, building);
    form.append(`CFV[${AMO.CUSTOM_FIELD.FLAT}]`, flat);
    form.append(
      `lead[STATUS]`,
      $("div#card_status_view_mode[data-status-id]").attr("data-status-id"),
    );
    form.append(`lead[PIPELINE_ID]`, $('input[name="lead[PIPELINE_ID]"]').attr("value"));
    form.append(`ID`, this.lead_id.toString());

    console.debug("UPDATE LEAD DATA", form);

    try {
      const res = await setLeadFields(this.lead_id, form);
      this.operationResult(res.ok ? "✔ УСПЕШНО" : "✘ ОШИБКА");
    } catch (error) {
      this.operationResult("✘ ОШИБКА");
      console.error("ADDRESS SANITIZER ERROR", error);
    }

    setTimeout(this.modalClose, 1000);
  }

  operationResult(result: string) {
    $("#modalAddressSanitizer").html(/*html*/ `
      <div class="modal-scroller custom-scroll">
        <div
          class="modal-body"
          style="display: block; top: 30%; left: calc(50% - 100px); margin-left: 0; margin-bottom: 0; width: 200px;"
        >
          <div class="modal-body__inner" style="text-align: center;">
            <h2 class="head_2" style="font-size: 18pt;">${result}</h2>
          </div>
        </div>
      </div>`);
  }

  async sendRequest(): Promise<SanitizedAddress> {
    let query = CFV(AMO.CUSTOM_FIELD.CITY).val() as string;
    if (CFV(AMO.CUSTOM_FIELD.STREET).val()) query += `, ${CFV(AMO.CUSTOM_FIELD.STREET).val()}`;
    if (CFV(AMO.CUSTOM_FIELD.BUILDING).val()) query += `, ${CFV(AMO.CUSTOM_FIELD.BUILDING).val()}`;
    if (CFV(AMO.CUSTOM_FIELD.FLAT).val()) query += `, кв ${CFV(AMO.CUSTOM_FIELD.FLAT).val()}`;
    if (CFV(AMO.CUSTOM_FIELD.INDEX).val()) query += `, ${CFV(AMO.CUSTOM_FIELD.INDEX).val()}`;

    const data: Query = {
      lead_id: this.lead_id,
      query,
    };

    console.debug("SEND ADDRESS SANITIZER REQUEST", data);

    try {
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw Error("ADDRESS SANITIZER ERROR, failed to get data from backend");
      }

      return await res.json();
    } catch (err) {
      console.error("ADDRESS SANITIZER ERROR", err);
      throw Error("ADDRESS SANITIZER ERROR, failed to get data from backend", err);
    }
  }
}
