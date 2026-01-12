import { BACKEND_BASE_URL, CFV } from "../common";
import { Plugin } from "./plugin";
import { Modal } from "./modal";

export class Permit extends Plugin {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/permit`;

  private modal: Modal;

  constructor(lead_id: number) {
    super(lead_id);
    console.debug("PERMIT LOADED", lead_id);
    this.modal = new Modal("Permit", {
      title: "🪪 Заказ пропуска",
      width: 500,
    });
    this.addTopListButton({
      id: "permit",
      icon: "🪪",
      text: "Заказ пропуска",
      onClick: () => this.render(),
    });
  }

  destructor() {
    console.debug("PERMIT DESTRUCTOR", this.lead_id);
    this.modal.close();
  }

  style() {
    return 'input.datetime_input:invalid + span:after { content: "❌"; }';
  }

  private render() {
    const min_date = this.calculateMinDate();
    const max_date = this.calculateMaxDate();
    const visit_date = CFV(1369498).attr("value");
    let target_date = this.formatDate(min_date);
    if (visit_date) {
      const [day, month, year] = visit_date.split(".");
      target_date = `${year}-${month}-${day}`;
    }

    const [last, first, middle] = $("input.js-linked-name-view").attr("value")?.split(" ");

    const content = /* html */ `<form>
        <div class="form-group">
          <label for="permitDate">Дата:</label>
          <input
            type="date"
            id="permitDate"
            class="form-control datetime_input"
            name="permitDate"
            value="${target_date}"
            min="${this.formatDate(min_date)}"
            max="${this.formatDate(max_date)}"
            required
          /><span class="validity"></span>
        </div>
        <div class="form-group">
          <label for="permitLast">Фамилия:</label>
          <input
            type="text"
            id="permitLast"
            class="form-control"
            ${last ? "value=" + last : ""}
            pattern="[а-яА-Я]{3,}"
            required
            title="3 символа и более"
          /><span class="validity"></span>
        </div>
        <div class="form-group">
          <label for="permitFirst">Имя:</label>
          <input
            type="text"
            id="permitFirst"
            class="form-control"
            ${first ? "value=" + first : ""}
            pattern="[а-яА-Я]{3,}"
            required
            title="3 символа и более"
          /><span class="validity"></span>
        </div>
        <div class="form-group">
          <label for="permitMiddle">Отчество:</label>
          <input
            type="text"
            id="permitMiddle"
            class="form-control"
            ${middle ? "value=" + middle : ""}
            pattern="[а-яА-Я]{3,}"
            required
            title="3 символа и более"
          /><span class="validity"></span>
        </div>
      </form>`;

    this.modal.create(content);

    this.modal.inner.append(`
        <div class="modal-footer">
          <button id="permitButtonCancel" type="button" class="btn btn-default">
            Отмена
          </button>
          <button id="permitButtonGo" type="button" class="btn btn-disabled">
            Заказать
          </button>
        </div>`);

    $("#permitButtonCancel").on("click", () => this.modal.close());
    $("button#permitButtonGo").on("click", async (el) => await this.sendPermit(el));
    $("input#permitDate").on("change", () => this.validate());
    $("input#permitFirst").on("change", () => this.validate());
    $("input#permitMiddle").on("change", () => this.validate());
    $("input#permitLast").on("change", () => this.validate());

    this.validate();
  }

  private validate(): boolean {
    const valid =
      ($("input#permitDate")[0] as HTMLFormElement)?.checkValidity() &&
      ($("input#permitFirst")[0] as HTMLFormElement)?.checkValidity() &&
      ($("input#permitMiddle")[0] as HTMLFormElement)?.checkValidity() &&
      ($("input#permitLast")[0] as HTMLFormElement)?.checkValidity();

    if (valid) {
      $("button#permitButtonGo").attr("class", "btn btn-primary");
    } else {
      $("button#permitButtonGo").attr("class", "btn btn-disabled");
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
    return new Date();
  }

  private calculateMaxDate(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 2, 0);
  }

  private async sendPermit(
    el: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>,
  ) {
    if ($(el.currentTarget).hasClass("btn-disabled")) {
      console.debug("NOT GO");
      return;
    }
    $(el.currentTarget).attr("class", "btn btn-disabled");

    const data = {
      lead_id: this.lead_id,
      date: $("input#permitDate").val() as string,
      first: $("input#permitFirst").val() as string,
      middle: $("input#permitMiddle").val() as string,
      last: $("input#permitLast").val() as string,
    };

    console.debug("SEND DATA PERMIT", data);

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
    }

    setTimeout(() => this.modal.close(), 1000);
  }
}
