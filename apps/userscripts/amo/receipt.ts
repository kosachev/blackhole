import { BACKEND_BASE_URL, leadGoods } from "../common";
import { Modal } from "./modal";

type Good = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

type ScanItem = Good & { barcodes: string[] };

export class Receipt {
  private readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/barcode_scan`;
  private readonly MODAL_TAG = "ScanBarcode";
  private modal: Modal;
  private scanTimeout: any = null;

  constructor(private lead_id: number) {
    this.modal = new Modal(this.MODAL_TAG, {
      title: "🧾 Пробить чек",
      width: 600,
      menu: { text: "Пробить чек", icon: "🧾" },
    });
    this.modal.initMenu(() => this.open());
    this.injectStyles();
  }

  destructor() {
    this.modal.close();
    $("head").find("style.receipt_scanner_styles").remove();
  }

  private async open() {
    try {
      this.modal.create(this.getModalContentHtml());
      this.bindEvents();
      setTimeout(() => this.focusTrap(), 100);
      await this.loadGoods();
    } catch (err) {
      console.error(err);
    }
  }

  private bindEvents() {
    const m = this.modal;
    const trap = m.inner.find("#scannerInputTrap");

    m.on("click", "#scanButtonCancel", () => m.close());
    m.on("click", "#scanButtonSend", (e) => this.submit(e));

    m.on("click", "li.scan_li", (e) => {
      this.onRowClick(e);
      this.focusTrap();
    });

    m.on("click", ".scan_clear_btn", (e) => {
      this.onClearClick(e);
      this.focusTrap();
    });

    m.el.on("click", (e) => {
      if (!$(e.target).closest("button, input, textarea, a").length) this.focusTrap();
    });

    trap.on("input", () => {
      const val = trap.val() as string;
      clearTimeout(this.scanTimeout);

      if (val.includes("\n") || val.includes("\r")) {
        this.handleInputData(val);
        trap.val("");
        return;
      }

      this.scanTimeout = setTimeout(() => {
        const finalVal = trap.val() as string;
        if (finalVal.trim().length > 0) {
          this.handleInputData(finalVal);
          trap.val("");
        }
      }, 200);
    });

    trap.on("keydown", (e) => {
      if (e.which === 13) {
        e.preventDefault();
        this.handleInputData(trap.val() as string);
        trap.val("");
      }
    });
  }

  private focusTrap() {
    const el = $("#scannerInputTrap");
    if (el.length) {
      const { scrollX, scrollY } = window;
      el.trigger("focus");
      window.scrollTo(scrollX, scrollY);
    }
  }

  private handleInputData(data: string) {
    const code = data ? data.replace(/[\n\r]+/g, "").trim() : "";
    if (code.length > 0) this.processBarcode(code);
  }

  private processBarcode(code: string) {
    let target = $("li.scan_li.active");
    if (target.length === 0) {
      this.activateNextEmpty();
      target = $("li.scan_li.active");
    }
    if (target.length > 0) this.addBarcode(target, code);
  }

  private addBarcode(row: JQuery<HTMLElement>, code: string) {
    const qty = +row.attr("data-quantity")!;
    const codes: string[] = JSON.parse(row.attr("data-barcodes") || "[]");

    if (codes.includes(code) || codes.length >= qty) return;

    codes.push(code);
    row.attr("data-barcodes", JSON.stringify(codes));
    this.updateRowState(row, codes, qty);

    if (codes.length === qty) this.activateNextEmpty(row);
    this.updateStats();
  }

  private activateNextEmpty(current?: JQuery<HTMLElement>) {
    let next = current ? current.nextAll("li.scan_li:not(.scanned)").first() : undefined;
    if (!next?.length) next = $("li.scan_li:not(.scanned)").first();

    if (next.length) {
      this.setActiveRow(next);
    } else {
      $("li.scan_li").removeClass("active");
    }
  }

  private onRowClick(e: any) {
    if ($(e.target).hasClass("scan_clear_btn")) return;
    this.setActiveRow($(e.currentTarget));
  }

  private onClearClick(e: any) {
    e.stopPropagation();
    const row = $(e.target).closest("li.scan_li");
    const qty = +row.attr("data-quantity")!;

    row.attr("data-barcodes", "[]");
    this.updateRowState(row, [], qty);
    this.setActiveRow(row);
    this.updateStats();
  }

  private setActiveRow(row: JQuery<HTMLElement>) {
    $("li.scan_li").removeClass("active");
    row.addClass("active");

    const container = this.modal.inner.find("#scanListContainer");
    if (!container.length) return;

    const itemTop = row.position().top;
    const itemH = row.outerHeight(true) || 60;
    const contH = container.height() || 400;
    const currentScroll = container.scrollTop() || 0;

    if (itemTop < 0 || itemTop + itemH > contH) {
      container.animate({ scrollTop: currentScroll + itemTop - contH / 2 + itemH / 2 }, 200);
    }
  }

  private updateRowState(row: JQuery<HTMLElement>, codes: string[], qty: number) {
    row.find(".scan_counter").text(`${codes.length} / ${qty}`);
    row.removeClass("scanned partial");

    const wrapper = row.find(".scan_codes_wrapper").empty();
    const placeholder = row.find(".scan_placeholder");
    const clearBtn = row.find(".scan_clear_btn");

    if (codes.length === 0) {
      wrapper.append(placeholder.show());
      clearBtn.hide();
    } else {
      clearBtn.show();
      row.addClass(codes.length >= qty ? "scanned" : "partial");
      codes.forEach((c) => {
        const txt = c.length > 12 ? "..." + c.slice(-6) : c;
        wrapper.append(`<span class="scan_code_pill" title="${c}">${txt}</span>`);
      });
    }
  }

  private updateStats() {
    const items = $("li.scan_li");
    const total = items.length;
    const ready = items.filter(".scanned").length;
    const hasData = items
      .toArray()
      .some((el) => JSON.parse($(el).attr("data-barcodes") || "[]").length > 0);

    $("#statTotal").text(`Позиций: ${total}`);
    $("#statScanned").text(`Готово: ${ready}`);
    $("#scanButtonSend").attr(
      "class",
      hasData ? "button-input button-input_blue" : "button-input button-cancel",
    );
  }

  private async loadGoods() {
    try {
      this.modal.loading = true;
      const goods = await leadGoods(this.lead_id);
      this.modal.loading = false;

      if (!goods.length) {
        this.modal.inner
          .find("ul#goodsListToScan")
          .append('<li style="text-align:center; padding: 20px; color: #888;">Товаров нет</li>');
        return;
      }

      goods.forEach((g) => this.renderRow(g));
      this.activateNextEmpty();
      this.updateStats();
    } catch (e) {
      console.error(e);
      this.modal.loading = false;
      this.modal.error("Ошибка загрузки");
    }
  }

  private renderRow(good: Good) {
    const html = `
      <li class="scan_li" id="good_${good.id}" data-id="${good.id}" data-price="${good.price}" data-quantity="${good.quantity}" data-barcodes='[]'>
        <div class="scan_status_icon"></div>
        <div class="scan_info">
            <div class="scan_name">${good.name}</div>
            <div class="scan_meta">${good.quantity} шт. × ${good.price} руб.</div>
        </div>
        <div class="scan_barcode_box">
            <div class="scan_counter">0 / ${good.quantity}</div>
            <div class="scan_codes_wrapper"><span class="scan_placeholder">Scan...</span></div>
            <span class="scan_clear_btn">Очистить всё</span>
        </div>
      </li>`;
    this.modal.inner.find("ul#goodsListToScan").append(html);
  }

  private async submit(e: any) {
    const btn = $(e.currentTarget);
    if (!btn.hasClass("button-input_blue")) return;

    btn.attr("class", "button-input button-cancel");

    const items: ScanItem[] = $("li.scan_li")
      .map((_, el) => {
        const $el = $(el);
        return {
          id: +$el.attr("data-id")!,
          name: $el.find(".scan_name").text(),
          quantity: +$el.attr("data-quantity")!,
          price: +$el.attr("data-price")!,
          barcodes: JSON.parse($el.attr("data-barcodes") || "[]"),
        };
      })
      .get();

    try {
      this.modal.loading = true;
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify({ lead_id: this.lead_id, items }),
      });

      this.modal.loading = false;

      if (res.ok) {
        this.modal.operationResult("✔ УСПЕШНО");
        setTimeout(() => this.modal.close(), 1500);
      } else {
        this.modal.error("ОШИБКА");
        this.updateStats();
      }
    } catch (err) {
      console.error(err);
      this.modal.loading = false;
      this.modal.error("ОШИБКА СЕТИ");
      this.updateStats();
    }
  }

  private getModalContentHtml(): string {
    return `
      <div style="width:0; height:0; overflow:hidden; position:absolute;">
        <input type="text" id="scannerInputTrap" autocomplete="off" style="opacity: 0; width: 1px; height: 1px; border: 0; padding: 0;" />
      </div>
      <div id="scanListContainer" style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
          <ul id="goodsListToScan"></ul>
      </div>
      <div class="scan_footer_stats">
          <span id="statTotal">Позиций: 0</span>
          <span id="statScanned" style="color: #20c997; font-weight: bold;">Готово: 0</span>
      </div>
      <div class="modal-footer">
          <button id="scanButtonSend" type="button" class="button-input button-cancel"><span class="button-input-inner"><span class="button-input-inner__text">Отправить</span></span></button>
          <button id="scanButtonCancel" type="button" class="button-input button-cancel"><span class="button-input-inner"><span class="button-input-inner__text">Отмена</span></span></button>
      </div>`;
  }

  private injectStyles() {
    $("head").append(
      `<style class="receipt_scanner_styles" type="text/css">
        .scan_li { display: flex; justify-content: space-between; align-items: flex-start; margin: 5px 0; padding: 10px 15px; border: 1px solid #eef2f4; border-radius: 4px; cursor: pointer; transition: background 0.2s, border-color 0.2s; background: #fff; position: relative; box-sizing: border-box; min-height: 60px; }
        .scan_li.scanned { background: #f0fcf6; border-color: #a6eacf; }
        .scan_li.partial { background: #fff9db; border-color: #ffe066; }
        .scan_li.active { border-color: #4c8bf7 !important; box-shadow: 0 0 0 2px rgba(76, 139, 247, 0.25); z-index: 5; }
        .scan_status_icon { width: 30px; min-width: 30px; display: flex; justify-content: center; align-items: center; align-self: center; margin-right: 12px; font-weight: bold; font-size: 26px; line-height: 1; text-align: center; }
        .scan_li.scanned .scan_status_icon:before { content: "✔"; color: #20c997; }
        .scan_li.partial .scan_status_icon:before { content: "•"; color: #fcc419; font-size: 36px; }
        .scan_li:not(.scanned):not(.partial) .scan_status_icon:before { content: "○"; color: #ccc; font-size: 22px; }
        .scan_info { flex-grow: 1; margin-right: 10px; align-self: center; }
        .scan_name { font-weight: bold; font-size: 14px; color: #333; line-height: 1.3; }
        .scan_meta { font-size: 12px; color: #888; margin-top: 4px; }
        .scan_barcode_box { width: 200px; text-align: right; display: flex; flex-direction: column; align-items: flex-end; align-self: center; }
        .scan_counter { font-size: 12px; font-weight: bold; color: #555; margin-bottom: 6px; background: #eee; padding: 3px 8px; border-radius: 10px; }
        .scanned .scan_counter { background: #20c997; color: white; }
        .partial .scan_counter { background: #fcc419; color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,0.1); }
        .scan_codes_wrapper { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; max-width: 100%; }
        .scan_code_pill { background: #e8ecef; padding: 2px 6px; border-radius: 3px; color: #333; font-family: monospace; font-size: 11px; border: 1px solid #dde2e5; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
        .scanned .scan_code_pill, .partial .scan_code_pill { background: rgba(255,255,255,0.7); border-color: rgba(0,0,0,0.1); }
        .scan_placeholder { color: #ccc; font-style: italic; font-size: 12px; }
        .scan_clear_btn { margin-top: 6px; color: #d6336c; font-size: 11px; cursor: pointer; border-bottom: 1px dashed #d6336c; display: none; }
        .scan_clear_btn:hover { color: #a61e4d; border-bottom-style: solid; }
        .scan_footer_stats { display: flex; justify-content: space-between; margin-bottom: 0; padding: 10px; background: #f9f9f9; border-radius: 4px; font-size: 13px; color: #555; }
      </style>`,
    );
  }
}
