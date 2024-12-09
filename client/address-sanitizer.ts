import { AMO } from "../src/amo/amo.constants";
import { BACKEND_BASE_URL, CFV, setLeadFields } from "./common";
import { Modal } from "./modal";

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
  private modal: Modal;

  constructor(private lead_id: number) {
    console.debug("ADDRESS SANITIZER LOADED", lead_id);

    this.modal = new Modal("address_sanitizer", {
      title: "🚩 Разбор адреса",
      width: 700,
    });

    $(`div[data-id=${AMO.CUSTOM_FIELD.CITY}] > div`)
      .first()
      .append(
        `<span id="address_sanitizer_trigger" style="margin-left: 5px; cursor: pointer">⟳</span>`,
      );

    $("head").append(/*html*/ `<style class="address_sanitizer_style" type="text/css">
        ${this.modal.id} .table {
          display: grid;
          grid-template-columns: 80px 1fr 1fr;
          border: 0.8px solid #c5c5c5;
          width: 100%;
        }

        ${this.modal.id} .cell {
          border: 0.8px solid #c5c5c5;
          padding: 6px;
          text-align: center;
        }

        ${this.modal.id} .cell.bold {
          font-weight: bold;
        }

        ${this.modal.id} .cell input {
          text-align: center;
        }
      </style>`);

    CFV(AMO.CUSTOM_FIELD.CITY).on("input", this.render);
    $("#address_sanitizer_trigger").on("click", async () => await this.modalCreate());
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
      $("#address_sanitizer_trigger").css("display", "none").css("color", "");
    } else {
      $("#address_sanitizer_trigger").css("display", "inherit");
    }
  }

  async modalCreate() {
    this.modal.create(/*html*/ `
       <div class="table">
        <div class="cell bold">Индекс</div>
        <div class="cell">${CFV(AMO.CUSTOM_FIELD.INDEX).val() ?? ""}</div>
        <div class="cell">
          <input type="text" placeholder="..." id="address_sanitizer_index" />
        </div>
        <div class="cell bold">Город</div>
        <div class="cell">${CFV(AMO.CUSTOM_FIELD.CITY).val() ?? ""}</div>
        <div class="cell">
          <input type="text" placeholder="..." id="address_sanitizer_city" />
        </div>
        <div class="cell bold">Улица</div>
        <div class="cell">${CFV(AMO.CUSTOM_FIELD.STREET).val() ?? ""}</div>
        <div class="cell">
          <input type="text" placeholder="..." id="address_sanitizer_street" />
        </div>
        <div class="cell bold">Дом</div>
        <div class="cell">${CFV(AMO.CUSTOM_FIELD.BUILDING).val() ?? ""}</div>
        <div class="cell">
          <input type="text" placeholder="..." id="address_sanitizer_building" />
        </div>
        <div class="cell bold">Квартира</div>
        <div class="cell">${CFV(AMO.CUSTOM_FIELD.FLAT).val() ?? ""}</div>
        <div class="cell">
          <input type="text" placeholder="..." id="address_sanitizer_flat" />
        </div>
      </div>`);

    $(`${this.modal.id} input`).on("input", () => this.validateData());
    this.modal.onSubmit("Обновить сделку", () => this.updateLeadData());

    await this.modalUpdate();
  }

  async modalUpdate() {
    try {
      this.modal.loading = true;
      const { index, city, street, building, flat } = await this.sendRequest();
      this.modal.loading = false;

      $("#address_sanitizer_index").val(index);
      $("#address_sanitizer_city").val(city);
      $("#address_sanitizer_street").val(street);
      $("#address_sanitizer_building").val(building);
      $("#address_sanitizer_flat").val(flat);

      this.validateData();
    } catch (error) {
      this.modal.loading = false;
      this.modal.error("ОШИБКА БЭКЭНДА");
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
      this.modal.submitActive();
    } else {
      this.modal.submitInactive();
    }
  }

  async updateLeadData() {
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
      this.modal.operationResult(res.ok ? "✔ УСПЕШНО" : "✘ ОШИБКА АМО");
    } catch (error) {
      this.modal.operationResult("✘ ОШИБКА АМО");
      console.error("ADDRESS SANITIZER ERROR", error);
    }

    setTimeout(this.modal.close, 1000);
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
