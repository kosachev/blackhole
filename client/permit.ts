import { BACKEND_BASE_URL, CFV } from "./common";

export class Permit {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/permit`;

  constructor(private lead_id: number) {
    console.debug("PERMIT LOADED", lead_id);
    const toplist = $("div.card-fields__top-name-more").find("ul");
    if ($(toplist).find("li div#permit").length === 0) {
      $(toplist).append(
        '<li class="button-input__context-menu__item  element__ "><div id="permit" class="button-input__context-menu__item__inner"><span class="button-input__context-menu__item__icon-container">🪪</span><span class="button-input__context-menu__item__text "> Заказ пропуска</span></div></li>',
      );
    }
    $("#permit").on("click", () => this.render());
    $("head").append(
      '<style class="permit" type="text/css">input.datetime_input:invalid + span:after { content: "\u274C" }</style>',
    );
  }

  destructor() {
    console.debug("PERMIT DESTRUCTOR", this.lead_id);
    $("head").find("style.permit").remove();
  }

  private render() {
    $("body").css("overflow", "hidden").attr("data-body-fixed", 1);
    $("body").append(
      `<div id="modalPermit" class="modal modal-list"><div class="modal-scroller custom-scroll"><div class="modal-body" style="display: block; top: 20%; left: calc(50% - 250px); margin-left: 0; margin-bottom: 0; width: 500px;"><div class="modal-body__inner"><span class="modal-body__close"><span id="closeModalPermit" class="icon icon-modal-close"></span></span><h2 class="modal-body__caption head_2">🪪 Заказ пропуска</h2><div id="permitInner"></div></div></div></div></div>`,
    );

    const min_date = this.calculateMinDate();
    const max_date = this.calculateMaxDate();
    const visit_date = CFV(1369498).attr("value");
    let target_date = this.formatDate(min_date);
    if (visit_date) {
      const [day, month, year] = visit_date.split(".");
      target_date = `${year}-${month}-${day}`;
    }

    const [last, first, middle] = $("input.js-linked-name-view").attr("value")?.split(" ");

    $("div#permitInner").append(`
      <form>
      <div>
      <label for="permitDate" style="display: inline-block; width: 70px; text-align: right; padding-right: 10px">Дата:</label>
      <input type="date" id="permitDate" class="datetime_input" name="permitDate" value="${target_date}" min="${this.formatDate(min_date)}" max="${this.formatDate(
        max_date,
      )}" required /><span class="validity"></span>
      </div>
      <div>
      <label for="permitLast" style="display: inline-block; width: 70px; text-align: right; padding-right: 10px">Фамилия:</label>
      <input type="text" id="permitLast" class="datetime_input" ${last ? "value=" + last : ""} style=" width: 100px" pattern="[а-яА-Я]{3,}" required title="3 символа и более" /><span class="validity"></span>
      </div>
      <div>
      <label for="permitFirst" style="display: inline-block; width: 70px; text-align: right; padding-right: 10px">Имя:</label>
      <input type="text" id="permitFirst" class="datetime_input" ${first ? "value=" + first : ""} style=" width: 100px" pattern="[а-яА-Я]{3,}" required title="3 символа и более" /><span class="validity"></span>
      </div>
      <div>
      <label for="permitMiddle" style="display: inline-block; width: 70px; text-align: right; padding-right: 10px">Отчество:</label>
      <input type="text" id="permitMiddle" class="datetime_input" ${middle ? "value=" + middle : ""} style=" width: 100px" pattern="[а-яА-Я]{3,}" required title="3 символа и более" /><span class="validity"></span>
      </div>
      </form>`);

    $("div#permitInner").append(
      '<hr><button id="permitButtonGo" type="button" class="button-input button-cancel"><span class="button-input-inner "><span class="button-input-inner__text">Заказать</span></span></button><button id="permitButtonCancel" type="button" class="button-input button-cancel"><span class="button-input-inner "><span class="button-input-inner__text">Отмена</span></span></button>',
    );

    $("#closeModalPermit").on("click", this.close);
    $("#permitButtonCancel").on("click", this.close);
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
      $("button#permitButtonGo").attr("class", "button-input button-input_blue");
    } else {
      $("button#permitButtonGo").attr("class", "button-input button-cancel button-input_disabled");
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

  private close() {
    $("body").attr("data-body-fixed", 0).attr("style", "");
    $("div#modalPermit").remove();
  }

  private async sendPermit(
    el: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>,
  ) {
    if ($(el.currentTarget).attr("class") !== "button-input button-input_blue") {
      console.debug("NOT GO");
      return;
    }
    $(el.currentTarget).attr("class", "button-input button-cancel");

    const data = {
      lead_id: this.lead_id,
      date: $("input#permitDate").val() as string,
      first: $("input#permitFirst").val() as string,
      middle: $("input#permitMiddle").val() as string,
      last: $("input#permitLast").val() as string,
    };

    console.debug("SEND DATA PERMIT", data);

    try {
      this.operationResult("⏳ ЗАГРУЗКА");
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(data),
      });

      this.operationResult(res.ok ? "✔ УСПЕШНО" : "✘ ОШИБКА");
    } catch (err) {
      this.operationResult("✘ ОШИБКА");
      console.error("Field to send data to backend", err);
    }

    setTimeout(this.close, 1000);
  }

  private operationResult(result: string) {
    $("div#modalPermit").html(
      `<div class="modal-scroller custom-scroll"><div class="modal-body" style="display: block; top: 30%; left: calc(50% - 100px); margin-left: 0; margin-bottom: 0; width: 200px;"><div class="modal-body__inner" style="text-align: center;"><h2 class="head_2" style="font-size: 18pt;">${result}</h2></div></div></div>`,
    );
  }
}
