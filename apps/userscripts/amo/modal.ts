type MenuParams = {
  text: string;
  icon: string;
};

type InitParams = {
  width?: number;
  title?: string;
  menu?: MenuParams;
};

export class Modal {
  private width: number;
  private title: string | undefined;
  private menu: MenuParams | undefined;

  constructor(private tag: string, params?: InitParams) {
    this.width = params?.width ?? 500;
    this.title = params?.title;
    this.menu = params?.menu;
  }

  get id(): string {
    return `#modal${this.tag}`;
  }

  get el(): JQuery<HTMLElement> {
    return $(this.id);
  }

  get inner(): JQuery<HTMLElement> {
    return $(`#modalInner${this.tag}`);
  }

  initMenu(onOpen: () => void) {
    if (!this.menu) return;

    const { text, icon } = this.menu;
    const btnId = `modalOpenBtn${this.tag}`;
    const container = $("div.card-fields__top-name-more").find("ul");

    if (container.find(`#${btnId}`).length === 0) {
      container.append(`
        <li class="button-input__context-menu__item element__">
          <div id="${btnId}" class="button-input__context-menu__item__inner">
            <span class="button-input__context-menu__item__icon-container">${icon}</span>
            <span class="button-input__context-menu__item__text">${text}</span>
          </div>
        </li>`);
    }

    $(`#${btnId}`)
      .off("click")
      .on("click", (e) => {
        e.preventDefault();
        onOpen();
      });
  }

  create(content: string) {
    $("body").css("overflow", "hidden").attr("data-body-fixed", 1);
    $("body").append(`
      <div id="modal${this.tag}" class="modal modal-list">
        <div class="modal-scroller custom-scroll">
          <div class="modal-body" style="display: block; top: 20%; left: calc(50% - ${
            this.width / 2
          }px); width: ${this.width}px;">
            <div class="overlay"><div class="loader"></div></div>
            <div class="modal-body__inner">
              <span class="modal-body__close"><span id="modalClose${
                this.tag
              }" class="close-button">✖</span></span>
              ${this.title ? `<h2 class="modal-title">${this.title}</h2>` : ""}
              <div id="modalInner${this.tag}">${content}</div>
            </div>
          </div>
        </div>
      </div>`);

    $(`#modalClose${this.tag}`).on("click", () => this.close());
  }

  on(event: string, selector: string, handler: (e: JQuery.Event) => void) {
    this.el.on(event, selector, handler);
  }

  onSubmit(text: string, callback: CallableFunction) {
    this.inner.append(`
      <div class="modal-footer">
        <button id="modalButtonSubmit${this.tag}" type="button" class="button-input button-cancel">
          <span class="button-input-inner"><span class="button-input-inner__text">${text}</span></span>
        </button>
      </div>`);

    const btn = $(`#modalButtonSubmit${this.tag}`);
    btn.on("click", async () => {
      if (!btn.hasClass("button-input_blue")) return;
      try {
        this.loading = true;
        await callback();
        this.loading = false;
        this.operationResult("✔ УСПЕШНО");
      } catch (err) {
        this.loading = false;
        console.error(err);
        this.operationResult("✘ ОШИБКА");
      }
      setTimeout(() => this.close(), 1000);
    });
  }

  operationResult(result: string) {
    this.el.html(`
      <div class="modal-scroller custom-scroll">
        <div class="modal-body" style="display: block; top: 30%; left: calc(50% - 125px); width: 250px;">
          <div class="modal-body__inner" style="text-align: center;">
            <h2 class="head_2" style="font-size: 18pt;">${result}</h2>
          </div>
        </div>
      </div>`);
  }

  submitActive() {
    $(`#modalButtonSubmit${this.tag}`).attr("class", "button-input button-input_blue");
  }

  submitInactive() {
    $(`#modalButtonSubmit${this.tag}`).attr(
      "class",
      "button-input button-cancel button-input_disabled",
    );
  }

  error(text: string) {
    this.operationResult(`✘ ${text}`);
    setTimeout(() => this.close(), 2000);
  }

  set loading(value: boolean) {
    this.el.find(".overlay").css("display", value ? "flex" : "none");
  }

  close() {
    $("body").attr("data-body-fixed", 0).attr("style", "");
    this.el.remove();
  }

  static get styles(): string {
    return /*css*/ `
      .modal .modal-title { text-align: center; font-size: 26px; font-weight: 600; font-family: "PT Sans", sans-serif; margin-bottom: 20px; }
      .modal .close-button { color: #333; cursor: pointer; }
      .modal .close-button:hover { color: red; }
      .modal .modal-footer { height: 50px; margin-top: 10px; display: flex; justify-content: flex-start; align-items: center; flex-direction: row-reverse; }
      .modal .overlay { display: none; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.3); z-index: 9999; }
      .modal .overlay .loader { border: 10px solid #f3f3f3; border-top: 10px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
  }
}
