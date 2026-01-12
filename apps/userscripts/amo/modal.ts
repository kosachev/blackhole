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
      <div id="modal${this.tag}" class="modal modal-list userscript-modal">
        <div class="modal-backdrop"></div>
        <div class="modal-scroller custom-scroll">
          <div class="modal-body" style="display: block; top: 20%; left: calc(50% - ${this.width / 2
      }px); width: ${this.width}px; margin-left: 0; margin-bottom: 0;">
            <div class="overlay"><div class="loader"></div></div>
            <div class="modal-body__inner">
              <span class="modal-body__close"><span id="modalClose${this.tag
      }" class="close-button">✖</span></span>
              ${this.title ? `<h2 class="modal-title">${this.title}</h2>` : ""}
              <div id="modalInner${this.tag}">${content}</div>
            </div>
          </div>
        </div>
      </div>`);

    $(`#modalClose${this.tag}`).on("click", () => this.close());
    // Also close on backdrop click?
    $(`#modal${this.tag} .modal-backdrop`).on("click", () => this.close());
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
        <div class="modal-body" style="display: block; top: 30%; left: calc(50% - 125px); width: 250px; margin-left: 0; margin-bottom: 0;">
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
      .userscript-modal { position: fixed !important; top: 0; left: 0; width: 100%; height: 100%; z-index: 9000; }
      .userscript-modal .modal-backdrop { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 1; }
      .userscript-modal .modal-scroller { position: relative; z-index: 2; height: 100%; overflow-y: auto; pointer-events: none; }
      .userscript-modal .modal-body { pointer-events: auto; } /* Re-enable pointer events for body */

      .modal .modal-title { text-align: center; font-size: 24px; font-weight: 700; font-family: "Robotos", "PT Sans", sans-serif; margin-bottom: 24px; color: #333; }
      .modal .close-button { color: #999; cursor: pointer; position: absolute; top: 15px; right: 15px; font-size: 18px; transition: color 0.2s; }
      .modal .close-button:hover { color: #f44336; }
      .modal .modal-body { padding: 30px; background: #fff; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
      .modal .modal-footer { margin-top: 30px; display: flex; justify-content: flex-end; align-items: center; gap: 12px; }

      /* Modern Form Styles - Floating Labels */
      .modal .form-group { 
        position: relative; 
        margin-bottom: 12px; 
        display: flex; 
        flex-direction: column; 
      }
      .modal .form-group label { 
        position: absolute; 
        top: -8px; 
        left: 10px; 
        background: #fff; 
        padding: 0 4px; 
        font-weight: 500; 
        font-size: 12px; 
        color: #777; 
        z-index: 1;
      }
      .modal .form-control {
        width: 100%; 
        padding: 12px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        font-size: 14px;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
      }
      .modal .form-control:focus { outline: none; border-color: #4c8bf7; box-shadow: 0 0 0 3px rgba(76, 139, 247, 0.1); }
      .modal .form-group:focus-within label { color: #4c8bf7; }
      .modal input[type="date"].form-control,
      .modal input[type="time"].form-control {
        width: auto;
        min-width: 160px;
        align-self: flex-start;
      }

      /* Modern Button Styles */
      .modal .btn {
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: background 0.2s;
        display: inline-flex; 
        align-items: center;
        justify-content: center;
      }
      .modal .btn-primary { background: #4c8bf7; color: white; }
      .modal .btn-primary:hover { background: #3b76d6; }
      .modal .btn-default { background: #f0f2f5; color: #555; }
      .modal .btn-default:hover { background: #e4e6e9; }
      .modal .btn-disabled { opacity: 0.6; cursor: not-allowed; }

      .modal .overlay { display: none; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255, 255, 255, 0.7); z-index: 9999; backdrop-filter: blur(2px); }
      .modal .overlay .loader { border: 4px solid #f3f3f3; border-top: 4px solid #4c8bf7; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
  }
}
