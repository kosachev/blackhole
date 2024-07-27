import { BACKEND_BASE_URL, CFV } from "./common";
import { AMO } from "../src/amo/amo.constants";

const defaultPickupTime = [
  { min: 9, max: 9, default: 9, can_choose: false },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 11, default: 11, can_choose: false },
];

export class CdekPickup {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/cdek_pickup`;

  private errors: string[] = [];

  constructor(private lead_id: number) {
    console.debug("CKED PICKUP LOADED", lead_id);
    const toplist = $("div.card-fields__top-name-more").find("ul");
    if ($(toplist).find("li div#cdekPickup").length === 0) {
      $(toplist).append(
        '<li class="button-input__context-menu__item  element__ "><div id="cdekPickup" class="button-input__context-menu__item__inner"><span class="button-input__context-menu__item__icon-container">📦</span><span class="button-input__context-menu__item__text "> Вызов курьера</span></div></li>',
      );
    }
    $("#cdekPickup").on("click", () => this.render());
    $("head").append(
      '<style class="cdek_pickup" type="text/css">input.datetime_input:invalid + span:after { content: "\u274C" }</style>',
    );
  }

  destructor() {
    console.debug("CKED PICKUP DESTRUCTOR", this.lead_id);
    $("head").find("style.cdek_pickup").remove();
  }

  private render() {
    $("body").css("overflow", "hidden").attr("data-body-fixed", 1);
    $("body").append(
      `<div id="modalCdekPickup" class="modal modal-list"><div class="modal-scroller custom-scroll"><div class="modal-body" style="display: block; top: 20%; left: calc(50% - 250px); margin-left: 0; margin-bottom: 0; width: 500px;"><div class="modal-body__inner"><span class="modal-body__close"><span id="closeModalCdekPickup" class="icon icon-modal-close"></span></span><h2 class="modal-body__caption head_2">📦 Вызов курьера</h2><div id="cdekPickupInner"></div></div></div></div></div>`,
    );

    this.errors = this.validatePreload();

    if (this.errors.length > 0) {
      $("div#cdekPickupInner").append(
        `<ul>${this.errors.map((e) => "<li>❌ " + e + "</li>").join("")}</ul>`,
      );
    } else {
      const min_date = this.calculateMinDate();
      const max_date = this.calculateMaxDate();
      const hours = this.calculateHours(min_date);

      $("div#cdekPickupInner").append(`
      <form>
      <label for="cdekPickupDate">Дата:</label>
      <input type="date" id="cdekPickupDate" class="datetime_input" name="cdekPickupDate" value="${this.formatDate(
        min_date,
      )}" min="${this.formatDate(min_date)}" max="${this.formatDate(
        max_date,
      )}" required /><span class="validity"></span>
      <label for="cdekPickupTime">Время:</label>
      <input type="time" id="cdekPickupTime" class="datetime_input" name="cdekPickupTime" value="${hours.default
        .toString()
        .padStart(2, "0")}:00" min="${hours.min.toString().padStart(2, "0")}:00" max="${hours.max
        .toString()
        .padStart(2, "0")}:00" step="3600" required ${
        hours.can_choose ? "" : "readonly"
      }/><span class="validity"></span>
      </form>`);
    }
    $("div#cdekPickupInner").append(
      '<hr><button id="cdekPickupButtonGo" type="button" class="button-input button-cancel"><span class="button-input-inner "><span class="button-input-inner__text">Вызвать</span></span></button><button id="cdekPickupButtonCancel" type="button" class="button-input button-cancel"><span class="button-input-inner "><span class="button-input-inner__text">Отмена</span></span></button>',
    );

    $("#closeModalCdekPickup").on("click", this.close);
    $("#cdekPickupButtonCancel").on("click", this.close);
    $("button#cdekPickupButtonGo").on("click", async (el) => await this.sendCdekPickup(el));
    $("input#cdekPickupDate").on("change", () => this.handlePickupDate());
    $("input#cdekPickupTime").on("change", () => this.validate());

    this.validate();
  }

  private handlePickupDate() {
    if (!this.validate()) return;
    const picked_date = new Date($("input#cdekPickupDate").val() as string);
    const hours = this.calculateHours(picked_date);
    const time = $("input#cdekPickupTime");
    time
      .val(hours.default.toString().padStart(2, "0") + ":00")
      .attr("min", hours.min.toString().padStart(2, "0") + ":00")
      .attr("max", hours.max.toString().padStart(2, "0") + ":00");
    if (hours.can_choose) {
      time.removeAttr("readonly");
    } else {
      time.attr("readonly", "");
    }
  }

  private validate(): boolean {
    const valid =
      ($("input#cdekPickupDate")[0] as HTMLFormElement)?.checkValidity() &&
      ($("input#cdekPickupTime")[0] as HTMLFormElement)?.checkValidity() &&
      this.errors.length === 0;

    if (valid) {
      $("button#cdekPickupButtonGo").attr("class", "button-input button-input_blue");
    } else {
      $("button#cdekPickupButtonGo").attr(
        "class",
        "button-input button-cancel button-input_disabled",
      );
    }

    return valid;
  }

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  }

  private calculateMinDate(): Date {
    const today = new Date();
    if (today.getHours() >= defaultPickupTime[today.getDay()].max) {
      today.setDate(today.getDate() + 1);
    }
    return today;
  }

  private calculateMaxDate(): Date {
    const today = new Date();
    today.setDate(today.getDate() + 7);
    return today;
  }

  private calculateHours(date: Date): (typeof defaultPickupTime)[number] {
    return defaultPickupTime[date.getDay()];
  }

  private close() {
    $("body").attr("data-body-fixed", 0).attr("style", "");
    $("div#modalCdekPickup").remove();
  }

  private validatePreload(): string[] {
    const errors: string[] = [];

    if (
      !CFV(AMO.CUSTOM_FIELD.TRACK_NUMBER).val() ||
      CFV(AMO.CUSTOM_FIELD.TRACK_NUMBER).val() === ""
    ) {
      errors.push("Отсутствует трек-код");
    }
    if (!CFV(AMO.CUSTOM_FIELD.CDEK_UUID).val() || CFV(AMO.CUSTOM_FIELD.CDEK_UUID).val() === "") {
      errors.push("Отсутствует сдек uuid");
    }
    if ($('div[data-id="1337998"] > div > div > button').text().trim() !== "Экспресс по России") {
      errors.push('Только для доставки типа "Экспресс по России"');
    }
    if (CFV(AMO.CUSTOM_FIELD.COURIER_CALLED).val() === "да") {
      errors.push("Курьер уже вызван");
    }

    return errors;
  }

  private async sendCdekPickup(
    el: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>,
  ) {
    if ($(el.currentTarget).attr("class") !== "button-input button-input_blue") {
      console.debug("NOT GO");
      return;
    }
    $(el.currentTarget).attr("class", "button-input button-cancel");

    const data = {
      lead_id: this.lead_id,
      track_code: CFV(AMO.CUSTOM_FIELD.TRACK_NUMBER).val() as string,
      uuid: CFV(AMO.CUSTOM_FIELD.CDEK_UUID).val() as string,
      intake_date: $("input#cdekPickupDate").val() as string,
      intake_time: $("input#cdekPickupTime").val() as string,
    };

    console.debug("SEND DATA CDEK PICKUP", data);

    try {
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(data),
      });

      this.operationResult(res.ok ? "✔ УСПЕШНО" : "✘ ОШИБКА");
      if (res.ok) {
        const pickups = JSON.parse(localStorage.getItem("cdek_pickups") ?? "[]");
        pickups.push({
          datetime: new Date(`${data.intake_date}T${data.intake_time}Z`).getTime(),
          date: data.intake_date,
          time: data.intake_time,
          track_code: data.track_code,
          uuid: data.uuid,
        });
        pickups.sort((a: any, b: any) => a.datetime - b.datetime);
        localStorage.setItem("cdek_pickups", JSON.stringify(pickups));
      }
    } catch (err) {
      this.operationResult("✘ ОШИБКА");
      console.error("Field to send data to backend", err);
    }

    setTimeout(this.close, 1000);
  }

  private operationResult(result: string) {
    $("div#modalCdekPickup").html(
      `<div class="modal-scroller custom-scroll"><div class="modal-body" style="display: block; top: 30%; left: calc(50% - 100px); margin-left: 0; margin-bottom: 0; width: 200px;"><div class="modal-body__inner" style="text-align: center;"><h2 class="head_2" style="font-size: 18pt;">${result}</h2></div></div></div>`,
    );
  }
}
