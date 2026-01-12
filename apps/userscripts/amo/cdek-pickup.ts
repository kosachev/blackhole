import { BACKEND_BASE_URL, CFV } from "../common";
import { AMO } from "../../../src/amo/amo.constants";
import { Plugin } from "./plugin";
import { Modal } from "./modal";

const defaultPickupTime = [
  { min: 9, max: 9, default: 9, can_choose: false },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 15, default: 15, can_choose: true },
  { min: 11, max: 11, default: 11, can_choose: false },
];



export class CdekPickup extends Plugin {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/cdek_pickup`;
  private modal: Modal;
  private errors: string[] = [];

  constructor(lead_id: number) {
    super(lead_id);
    console.debug("CKED PICKUP LOADED", lead_id);
    this.modal = new Modal("CdekPickup", {
      title: "📦 Вызов курьера",
      width: 500,
    });
    this.addTopListButton({
      id: "cdekPickup",
      icon: "📦",
      text: "Вызов курьера",
      onClick: () => this.render(),
    });
  }

  destructor() {
    console.debug("CKED PICKUP DESTRUCTOR", this.lead_id);
    this.modal.close();
  }

  style() {
    return 'input.datetime_input:invalid + span:after { content: "\\u274C" }';
  }

  private render() {
    this.errors = this.validatePreload();
    let content = "";

    if (this.errors.length > 0) {
      content = `<ul>${this.errors.map((e) => "<li>❌ " + e + "</li>").join("")}</ul>`;
      this.modal.create(content);
      // Even if errors, show close button
      this.modal.inner.append(`
        <div class="modal-footer">
          <button id="cdekPickupButtonCancel" type="button" class="btn btn-default">
            Закрыть
          </button>
        </div>
      `);
      $("#cdekPickupButtonCancel").on("click", () => this.modal.close());
    } else {
      const min_date = this.calculateMinDate();
      const max_date = this.calculateMaxDate();
      const hours = this.calculateHours(min_date);

      content = `
      <form>
      <div class="form-group">
        <label for="cdekPickupDate">Дата:</label>
        <input type="date" id="cdekPickupDate" class="form-control datetime_input" name="cdekPickupDate" value="${this.formatDate(
        min_date,
      )}" min="${this.formatDate(min_date)}" max="${this.formatDate(
        max_date,
      )}" required /><span class="validity"></span>
      </div>
      <div class="form-group">
        <label for="cdekPickupTime">Время:</label>
        <input type="time" id="cdekPickupTime" class="form-control datetime_input" name="cdekPickupTime" value="${hours.default
          .toString()
          .padStart(2, "0")}:00" min="${hours.min.toString().padStart(2, "0")}:00" max="${hours.max
            .toString()
            .padStart(2, "0")}:00" step="3600" required ${hours.can_choose ? "" : "readonly"
        }/><span class="validity"></span>
      </div>
      </form>`;

      this.modal.create(content);

      this.modal.inner.append(`
        <div class="modal-footer">
          <button id="cdekPickupButtonCancel" type="button" class="btn btn-default">
            Отмена
          </button>
          <button id="cdekPickupButtonGo" type="button" class="btn btn-disabled">
            Вызвать
          </button>
        </div>`);

      $("#cdekPickupButtonCancel").on("click", () => this.modal.close());
      $("button#cdekPickupButtonGo").on("click", async (el) => await this.sendCdekPickup(el));
      $("input#cdekPickupDate").on("change", () => this.handlePickupDate());
      $("input#cdekPickupTime").on("change", () => this.validate());

      this.validate();
    }
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
      $("button#cdekPickupButtonGo").attr("class", "btn btn-primary");
    } else {
      $("button#cdekPickupButtonGo").attr(
        "class",
        "btn btn-disabled",
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
    if ($(el.currentTarget).hasClass("btn-disabled")) {
      console.debug("NOT GO");
      return;
    }
    $(el.currentTarget).attr("class", "btn btn-disabled");

    const data = {
      lead_id: this.lead_id,
      track_code: CFV(AMO.CUSTOM_FIELD.TRACK_NUMBER).val() as string,
      uuid: CFV(AMO.CUSTOM_FIELD.CDEK_UUID).val() as string,
      intake_date: $("input#cdekPickupDate").val() as string,
      intake_time: $("input#cdekPickupTime").val() as string,
    };

    console.debug("SEND DATA CDEK PICKUP", data);

    try {
      this.modal.loading = true;
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(data),
      });

      this.modal.loading = false;
      this.modal.operationResult(res.ok ? "✔ УСПЕШНО" : "✘ ОШИБКА");
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
      this.modal.loading = false;
      this.modal.operationResult("✘ ОШИБКА");
      console.error("Field to send data to backend", err);
    }

    setTimeout(() => this.modal.close(), 1000);
  }
}
