import { BACKEND_BASE_URL, leadGoods } from "../common";

type Good = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

type ScanItem = Good & { barcodes: string[] };

export class Receipt {
  private readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/barcode_scan`;
  private scanBuffer: string = "";
  private scanTimeout: any = null;

  constructor(private lead_id: number) {
    this.initButton();
    this.injectStyles();
  }

  destructor() {
    $("head").find("style.receipt_scanner_styles").remove();
    $(document).off(".receiptScanner");
  }

  private initButton() {
    const container = $("div.card-fields__top-name-more").find("ul");
    if (container.find("#scanBarcode").length === 0) {
      container.append(
        '<li class="button-input__context-menu__item element__"><div id="scanBarcode" class="button-input__context-menu__item__inner"><span class="button-input__context-menu__item__icon-container">🧾</span><span class="button-input__context-menu__item__text"> Пробить чек</span></div></li>',
      );
    }
    $("#scanBarcode").on("click", async () => await this.open());
  }

  // --- LIFECYCLE ---

  private async open() {
    $("body").css("overflow", "hidden").attr("data-body-fixed", 1);
    this.renderModal();
    this.bindEvents();
    await this.loadGoods();
  }

  private close() {
    $("body").attr("data-body-fixed", 0).removeAttr("style");
    $(document).off(".receiptScanner");
    $("div#modalScanBarcode").remove();
  }

  private bindEvents() {
    $("#closeModalScan, #scanButtonCancel").on("click", () => this.close());
    $("#scanButtonSend").on("click", (e) => this.submit(e));

    const list = $("#modalScanBarcode");
    list.on("click", "li.scan_li", (e) => this.onRowClick(e));
    list.on("click", ".scan_clear_btn", (e) => this.onClearClick(e));

    $(document).on("paste.receiptScanner", (e) => this.onPaste(e));
    $(document).on("keydown.receiptScanner", (e) => this.onKeydown(e));
  }

  // --- INPUT HANDLERS ---

  private onKeydown(e: JQuery.KeyDownEvent) {
    if ($(e.target).is("input, textarea")) return;

    if (e.which === 13) {
      if (this.scanBuffer.length > 0) {
        this.processBarcode(this.scanBuffer);
        this.scanBuffer = "";
      }
      return;
    }

    if (e.key && e.key.length === 1) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = setTimeout(() => (this.scanBuffer = ""), 200);
      this.scanBuffer += e.key;
    }
  }

  private onPaste(e: any) {
    const clipboard =
      e.clipboardData ||
      (window as any).clipboardData ||
      (e.originalEvent && e.originalEvent.clipboardData);
    const data = clipboard?.getData("text");
    if (data?.trim()) {
      e.preventDefault();
      this.processBarcode(data.trim());
    }
  }

  private onRowClick(e: JQuery.ClickEvent) {
    if ($(e.target).hasClass("scan_clear_btn")) return;
    this.setActiveRow($(e.currentTarget));
  }

  private onClearClick(e: JQuery.ClickEvent) {
    e.stopPropagation();
    const row = $(e.target).closest("li.scan_li");
    const qty = +row.attr("data-quantity")!;

    row.attr("data-barcodes", "[]");
    this.updateRowState(row, [], qty);
    this.setActiveRow(row);
    this.updateStats();
  }

  // --- CORE LOGIC ---

  private processBarcode(code: string) {
    let target = $("li.scan_li.active");

    if (target.length === 0) {
      this.activateNextEmpty();
      target = $("li.scan_li.active");
    }

    if (target.length > 0) {
      this.addBarcode(target, code);
    }
  }

  private addBarcode(row: JQuery<HTMLElement>, code: string) {
    const qty = +row.attr("data-quantity")!;
    const codes: string[] = JSON.parse(row.attr("data-barcodes") || "[]");

    if (codes.includes(code) || codes.length >= qty) return;

    codes.push(code);
    row.attr("data-barcodes", JSON.stringify(codes));

    this.updateRowState(row, codes, qty);

    if (codes.length === qty) {
      this.activateNextEmpty(row);
    }
    this.updateStats();
  }

  private activateNextEmpty(current?: JQuery<HTMLElement>) {
    let next = current ? current.nextAll("li.scan_li:not(.scanned)").first() : undefined;

    if (!next || next.length === 0) {
      next = $("li.scan_li:not(.scanned)").first();
    }

    if (next.length > 0) {
      this.setActiveRow(next);
    } else {
      $("li.scan_li").removeClass("active");
    }
  }

  // --- UI RENDERING ---

  private renderModal() {
    $("body").append(
      `<div id="modalScanBarcode" class="modal modal-list">
        <div class="modal-scroller custom-scroll">
            <div class="modal-body" style="display: block; top: 20%; left: calc(50% - 300px); margin-left: 0; margin-bottom: 0; width: 600px;">
                <div class="modal-body__inner">
                    <span class="modal-body__close"><span id="closeModalScan" class="icon icon-modal-close"></span></span>
                    <h2 class="modal-body__caption head_2">🧾 Пробить чек</h2>
                    <div id="scanListContainer" style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
                        <ul id="goodsListToScan"></ul>
                    </div>
                    <div class="scan_footer_stats">
                        <span id="statTotal">Позиций: 0</span>
                        <span id="statScanned" style="color: #20c997; font-weight: bold;">Готово: 0</span>
                    </div>
                    <hr>
                    <button id="scanButtonSend" type="button" class="button-input button-cancel">
                        <span class="button-input-inner"><span class="button-input-inner__text">Отправить</span></span>
                    </button>
                    <button id="scanButtonCancel" type="button" class="button-input button-cancel">
                        <span class="button-input-inner"><span class="button-input-inner__text">Отмена</span></span>
                    </button>
                </div>
            </div>
        </div>
      </div>`,
    );
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
    $("ul#goodsListToScan").append(html);
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

  private setActiveRow(row: JQuery<HTMLElement>) {
    $("li.scan_li").removeClass("active");
    row.addClass("active");

    const container = $("#scanListContainer");
    const itemTop = row.position().top;
    const itemH = row.outerHeight(true) || 60;
    const contH = container.height() || 400;
    const currentScroll = container.scrollTop() || 0;

    if (itemTop < 0 || itemTop + itemH > contH) {
      container.animate({ scrollTop: currentScroll + itemTop - contH / 2 + itemH / 2 }, 200);
    }
  }

  private updateStats() {
    const total = $("li.scan_li").length;
    const ready = $("li.scan_li.scanned").length;
    let hasData = false;

    $("li.scan_li").each((_, el) => {
      if (JSON.parse($(el).attr("data-barcodes") || "[]").length > 0) hasData = true;
    });

    $("#statTotal").text(`Позиций: ${total}`);
    $("#statScanned").text(`Готово: ${ready}`);
    $("button#scanButtonSend").attr(
      "class",
      hasData ? "button-input button-input_blue" : "button-input button-cancel",
    );
  }

  private showResult(msg: string) {
    $("div#modalScanBarcode").html(
      `<div class="modal-scroller custom-scroll">
         <div class="modal-body" style="top: 30%; left: calc(50% - 150px); width: 300px;">
           <div class="modal-body__inner" style="text-align: center;">
             <h2 class="head_2" style="font-size: 16pt; margin: 20px 0;">${msg}</h2>
           </div>
         </div>
       </div>`,
    );
    setTimeout(() => this.close(), 1500);
  }

  // --- DATA & NETWORK ---

  private async loadGoods() {
    try {
      const goods = await leadGoods(this.lead_id);
      if (!goods.length) {
        $("ul#goodsListToScan").append(
          '<li style="text-align:center; padding: 20px; color: #888;">Товаров нет</li>',
        );
        return;
      }
      goods.forEach((g) => this.renderRow(g));
      this.activateNextEmpty();
      this.updateStats();
    } catch (e) {
      console.error(e);
      alert("Ошибка получения товаров");
    }
  }

  private async submit(e: JQuery.ClickEvent) {
    const btn = $(e.currentTarget);
    if (!btn.hasClass("button-input_blue")) return;

    btn.attr("class", "button-input button-cancel");

    const items: ScanItem[] = [];
    $("li.scan_li").each((_, el) => {
      const $el = $(el);
      const codes = JSON.parse($el.attr("data-barcodes") || "[]");

      items.push({
        id: +$el.attr("data-id")!,
        name: $el.find(".scan_name").text(),
        quantity: +$el.attr("data-quantity")!,
        price: +$el.attr("data-price")!,
        barcodes: codes,
      });
    });

    try {
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify({ lead_id: this.lead_id, items }),
      });
      this.showResult(res.ok ? "✔ ДАННЫЕ ОТПРАВЛЕНЫ" : "✘ ОШИБКА ОТПРАВКИ");
    } catch (err) {
      console.error(err);
      this.showResult("✘ ОШИБКА СЕТИ");
    }
  }

  private injectStyles() {
    $("head").append(
      `<style class="receipt_scanner_styles" type="text/css">
        .modal-body__close:hover #closeModalScan { color: #ff5c5c !important; opacity: 1 !important; }
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
        .scan_footer_stats { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 4px; font-size: 13px; color: #555; }
      </style>`,
    );
  }
}
