import { AMO } from "../../../src/amo/amo.constants";
import { BACKEND_BASE_URL, CFV } from "../common";

import { Plugin } from "./plugin";
import { Modal } from "./modal";

type Template = {
  name: string;
  text?: string;
  payment?: boolean;
};

const TEMPLATES: Template[] = [
  { name: "Telegram", text: "Меховой салон GERDA. Наш телеграм https://t.me/gerda_msk" },
  { name: "MAX", text: "Меховой салон GERDA. Наш MAX https://gerdacollection.ru/max" },
  { name: "Реквизиты", payment: true },
];

const PHONE_SELECTOR = 'input.control-phone__formatted, input[type="tel"]';
const MENU_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>';

function smsPhone(raw?: string | null): string {
  const value = String(raw ?? "").trim();
  if (!/^[+\d\s().-]+$/.test(value)) return "";
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "8") digits = "7" + digits.slice(1);
  else if (digits.length === 10 && !value.startsWith("+")) digits = "7" + digits;
  return /^[1-9]\d{9,14}$/.test(digits) ? "+" + digits : "";
}

export class Sms extends Plugin {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/sms`;

  private modal: Modal;
  private observer: MutationObserver;
  private timer: number;
  private schedule = () => {
    clearTimeout(this.scheduleTimer);
    this.scheduleTimer = window.setTimeout(() => this.scan(), 150);
  };
  private scheduleTimer: number;
  private mounted = new Map<Element, { item: HTMLElement; input: HTMLInputElement }>();
  private templates = new Set(TEMPLATES.filter((item) => item.text).map((item) => item.text));

  constructor(lead_id: number) {
    super(lead_id);
    console.debug("SMS LOADED", lead_id);

    this.modal = new Modal("Sms", {
      title: "✉ Отправить SMS",
      width: 490,
    });

    this.scan();

    this.observer = new MutationObserver(this.schedule);
    this.observer.observe(document.body, { subtree: true, childList: true });
    document.addEventListener("input", this.schedule, true);
    this.timer = window.setInterval(() => this.scan(), 2000);
  }

  destructor() {
    console.debug("SMS DESTRUCTOR", this.lead_id);
    this.observer.disconnect();
    document.removeEventListener("input", this.schedule, true);
    clearTimeout(this.scheduleTimer);
    window.clearInterval(this.timer);
    for (const [menu, mount] of this.mounted) {
      mount.item.remove();
      this.mounted.delete(menu);
    }
    this.modal.close();
  }

  style() {
    return /*css*/ `
      .sms_menu_item { cursor: pointer; color: #285b45; }
      .sms_menu_item:hover { background-color: var(--palette-background-default); }
      .modal .sms_form label { display: block; margin: 14px 0 6px; font-size: 12px; font-weight: 600; color: #69766f; }
      .modal input#smsTo { background: #f3f6f3; font-weight: 600; }
      .modal textarea#smsText { min-height: 150px; resize: vertical; line-height: 1.6; font-family: inherit; }
      .modal .sms_count { margin-top: 8px; text-align: right; font-size: 12px; color: #7c8981; }
      .modal .sms_templates { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px; }
      .modal .sms_template { padding: 6px 12px; font-size: 13px; }
      .modal .sms_status:not(:empty) { margin-top: 16px; font-size: 13px; color: #ac4039; white-space: pre-wrap; }
    `;
  }

  private scan() {
    document.querySelectorAll(".card-cf-actions-tip .js-tip-items").forEach((menu) => {
      if (this.mounted.has(menu)) return;

      const field = menu.closest(".js-linked-with-actions");
      const input = field?.querySelector(PHONE_SELECTOR) as HTMLInputElement | null;
      if (!input) return;

      const item = document.createElement("div");
      item.className = "tips-item sms_menu_item";
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      item.innerHTML = `<span class="tips-icon-container">${MENU_ICON}</span><span>Отправить SMS</span>`;

      const activate = (event: Event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const current = field.querySelector(PHONE_SELECTOR) as HTMLInputElement | null;
        const phone = smsPhone(current?.value);
        if (phone) this.render(phone);
      };

      item.addEventListener("click", activate);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") activate(event);
      });

      item.hidden = !smsPhone(input.value);
      menu.insertBefore(item, menu.querySelector('[data-type="copy"]'));
      this.mounted.set(menu, { item, input });
    });

    for (const [menu, mount] of this.mounted) {
      if (!menu.isConnected || !mount.input.isConnected) {
        mount.item.remove();
        this.mounted.delete(menu);
        continue;
      }
      mount.item.hidden = !smsPhone(mount.input.value);
    }
  }

  private render(phone: string) {
    if (this.modal.el.length) this.modal.close();

    const content = /*html*/ `<div class="sms_form">
        <label for="smsTo">Получатель</label>
        <input id="smsTo" class="form-control" readonly />
        <label for="smsText">Сообщение</label>
        <textarea id="smsText" class="form-control" spellcheck="true"></textarea>
        <div class="sms_count" id="smsCount" aria-live="polite"></div>
        <div class="sms_templates" id="smsTemplates" role="group" aria-label="Шаблоны сообщений"></div>
        <div class="sms_status" id="smsStatus" role="status" aria-live="polite"></div>
      </div>`;

    this.modal.create(content);

    this.modal.inner.append(`
      <div class="modal-footer">
        <button id="smsButtonCancel" type="button" class="btn btn-default">
          Отмена
        </button>
        <button id="smsButtonSend" type="button" class="btn btn-disabled">
          Отправить SMS
        </button>
      </div>
    `);

    $("#modalSms")[0]?.addEventListener("keydown", (event) => event.stopPropagation());

    $("input#smsTo").val(phone);
    $("textarea#smsText").val(TEMPLATES[0].text);

    TEMPLATES.forEach((template) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-default sms_template";
      button.textContent = template.name;
      button.title = template.payment
        ? "Подставить ссылку из Банк → PaymentURL текущей сделки"
        : template.text!;
      button.onclick = () => this.applyTemplate(template);
      $("#smsTemplates").append(button);
    });

    $("#smsButtonCancel").on("click", () => this.modal.close());
    $("#smsButtonSend").on("click", async () => await this.send());
    $("textarea#smsText").on("input", () => this.sync());

    this.sync();
    $("textarea#smsText").trigger("focus");
  }

  private paymentTemplate(): string {
    const value = (CFV(AMO.CUSTOM_FIELD.BANK_PAYMENTURL).val() as string)?.trim();

    if (!value) {
      throw new Error(
        "В этой сделке не заполнено поле «Банк → PaymentURL». Текст сообщения не изменён.",
      );
    }

    let url: URL | undefined;
    try {
      url = new URL(value);
    } catch {
      url = undefined;
    }

    if (
      !url ||
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      /\s/.test(value)
    ) {
      throw new Error(
        "В поле «Банк → PaymentURL» должна быть полная ссылка на оплату, начинающаяся с https://. Текст сообщения не изменён.",
      );
    }

    return "Меховой салон GERDA. Ссылка на оплату - " + value;
  }

  private applyTemplate(template: Template) {
    let text: string;
    try {
      text = template.payment ? this.paymentTemplate() : template.text!;
    } catch (error) {
      this.say((error as Error).message);
      return;
    }

    const field = $("textarea#smsText");
    const value = (field.val() as string) ?? "";

    if (!value.trim() || this.templates.has(value.trim())) {
      field.val(text);
    } else if (!value.includes(text)) {
      field.val(value + (/\s$/.test(value) ? "" : "\n\n") + text);
    }

    this.templates.add(text);
    this.say("");
    this.sync();
  }

  private say(message: string) {
    $("#smsStatus").text(message);
  }

  private sync() {
    const text = ($("textarea#smsText").val() as string) ?? "";
    $("#smsCount").text(`${Array.from(text).length} символов, включая пробелы`);
    if (text.trim()) {
      $("#smsButtonSend").attr("class", "btn btn-primary");
    } else {
      $("#smsButtonSend").attr("class", "btn btn-disabled");
    }
  }

  private async send() {
    if ($("#smsButtonSend").hasClass("btn-disabled")) return;
    $("#smsButtonSend").attr("class", "btn btn-disabled");

    const data = {
      lead_id: this.lead_id,
      phone: $("input#smsTo").val(),
      text: $("textarea#smsText").val(),
    };

    console.debug("SEND SMS DATA", data);

    try {
      this.modal.loading = true;
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(data),
      });
      this.modal.loading = false;

      if (res.ok) {
        this.modal.operationResult("✔ УСПЕШНО");
        setTimeout(() => this.modal.close(), 1000);
      } else {
        this.modal.error(`Ошибка отправки SMS (HTTP ${res.status})`);
      }
    } catch (err) {
      this.modal.loading = false;
      this.modal.error("Не удалось связаться с сервером");
      console.error("Failed to send SMS request to backend", err);
    }
  }
}
