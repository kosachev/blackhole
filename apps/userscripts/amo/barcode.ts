import { AMO } from "../../../src/amo/amo.constants";
import { Modal } from "./modal";
import { Plugin } from "./plugin";

const PATTERNS =
  "2122222221222222211212231213221312221222131223121322122212132213122312121122321221321222311132221231221232212232112211322212312132122231123121313112223211223212213122123221123222112121232123212321211113231311231313211123131321131323112113132311132313111121331123311321311131231133211331213131212113312311312131132133112131313111233113213311213121133123113321113141112214114311111112241114221211241214211411221412211122141124121221141224111421121422112412112211144131112411121341111112421211421212411142121241121242114112124211124212112121412141214121211111431113411311411141131143114111134113111131411141313111414111312114122112142112322331112";

export function code128(sku: string): { path: string; width: number } {
  if (!sku.length || /[^\x20-\x7e]/.test(sku)) {
    throw new Error(
      "Артикул должен содержать только латинские буквы, цифры и печатные символы ASCII.",
    );
  }

  const codes: number[] = [];
  let mode = "";
  let i = 0;
  while (i < sku.length) {
    const pair = /^\d{2}/.test(sku.slice(i, i + 2));
    if (pair) {
      if (mode !== "C") {
        codes.push(codes.length === 0 ? 105 : 99);
        mode = "C";
      }
      codes.push(Number(sku.slice(i, i + 2)));
      i += 2;
    } else {
      if (mode !== "B") {
        codes.push(codes.length === 0 ? 104 : 100);
        mode = "B";
      }
      codes.push(sku.charCodeAt(i) - 32);
      i++;
    }
  }

  let checksum = codes[0];
  for (let j = 1; j < codes.length; j++) checksum += codes[j] * j;
  codes.push(checksum % 103, 106);

  let x = 20;
  let path = "";
  for (const code of codes) {
    const pattern = PATTERNS.slice(code * 6, code * 6 + (code === 106 ? 7 : 6));
    for (let k = 0; k < pattern.length; k++) {
      const width = Number(pattern[k]) * 2;
      if (k % 2 === 0) path += `M${x} 10h${width}v70h-${width}z `;
      x += width;
    }
  }
  return { path, width: x + 20 };
}

export class Barcode extends Plugin {
  private modal = new Modal("Barcode", {
    title: "Штрихкод",
    width: 400,
  });

  private root: Element | null = null;
  private observer?: MutationObserver;
  private readonly skuSelector = `[id="${AMO.CATALOG.GOODS}"] .catalog-fields__text--sku`;

  constructor(lead_id: number) {
    super(lead_id);
    if (!lead_id) return;
    this.root =
      document.querySelector(".card-fields__linked-block.js-linked_elements_wrapper") ??
      document.body;
    this.root.addEventListener("click", this.onClick);
    this.addButtons();
    this.observer = new MutationObserver(() => this.addButtons());
    this.observer.observe(this.root, { childList: true, subtree: true, characterData: true });
  }

  private addButtons() {
    this.root?.querySelectorAll(this.skuSelector).forEach((sku) => {
      const existing = sku.nextElementSibling;
      if (!sku.textContent?.trim()) {
        if (existing?.matches(".userscript-barcode-button")) existing.remove();
        return;
      }
      if (existing?.matches(".userscript-barcode-button")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "userscript-barcode-button";
      button.title = "Показать штрихкод";
      button.setAttribute("aria-label", "Показать штрихкод");
      button.textContent = "▥";
      sku.insertAdjacentElement("afterend", button);
    });
  }

  private onClick = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(".userscript-barcode-button");
    const sku = button?.previousElementSibling;
    if (!sku?.matches(this.skuSelector)) return;
    event.preventDefault();
    event.stopPropagation();
    this.open(sku.textContent?.trim() ?? "");
  };

  style() {
    return /*css*/ `
      [id="${AMO.CATALOG.GOODS}"] .catalog-fields__container-item--sku { display: flex; align-items: center; }
      .userscript-barcode-button { flex-shrink: 0; margin-left: 6px; padding: 0; border: 0; background: none; color: inherit; cursor: pointer; font-size: 18px; }
    `;
  }

  open(sku: string) {
    if (this.modal.el.length) this.modal.close();
    this.modal.create("");
    try {
      const { path, width } = code128(sku);
      this.modal.inner.html(/*html*/ `
        <div style="overflow-x: auto; text-align: center; background: #fff;">
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="110"
            viewBox="0 0 ${width} 110" role="img" aria-label="Штрихкод товара"
            style="max-width: none; background: #fff;">
            <path d="${path}" fill="#000"/>
            <text x="${width / 2}" y="98" text-anchor="middle"
              font-family="monospace" font-size="14" fill="#000"></text>
          </svg>
        </div>`);
      this.modal.inner.find("text").get(0)!.textContent = sku;
    } catch (error) {
      this.modal.inner.text(
        error instanceof Error ? error.message : "Не удалось создать штрихкод.",
      );
    }
  }

  destructor() {
    this.observer?.disconnect();
    this.root?.removeEventListener("click", this.onClick);
    this.root?.querySelectorAll(".userscript-barcode-button").forEach((button) => button.remove());
    if (this.modal.el.length) this.modal.close();
  }
}
