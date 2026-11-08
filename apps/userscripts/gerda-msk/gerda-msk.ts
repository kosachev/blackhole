import { BACKEND_BASE_URL } from "../common";

console.warn("TEMPER MONKEY SCRIPT LOADED");

type Data = {
  name: string;
  product_id: string;
  code: string;
  size: string;
  price: number;
};

(($: JQueryStatic) => {
  function parseData(): Data {
    const heading = document.querySelector("#name_product")?.cloneNode(true) as HTMLElement | undefined;
    heading?.querySelectorAll(".jshop_code_prod").forEach((element) => element.remove());
    const selectedSize = document.querySelector<HTMLInputElement | HTMLSelectElement>(
      'input[name="jshop_attr_id[2]"]:checked, select[name="jshop_attr_id[2]"]',
    );
    let size = "";
    if (selectedSize && selectedSize.value !== "0" && selectedSize.value !== "") {
      size = selectedSize.tagName === "SELECT"
        ? (selectedSize as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? ""
        : (selectedSize as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? "";
    }

    return {
      name: heading?.textContent?.trim() ?? "",
      product_id: ($("input#product_id")?.val() as string) ?? "",
      code: $("#product_code").text().trim(),
      size,
      price: Number($("span.prod_price_span")?.text()?.replaceAll(" ", "").trim() ?? "0"),
    };
  }

  function generateSku(code: string, size: string): string {
    return code.trim() + size.trim();
  }

  function check(data: Data): boolean {
    return data.name.length > 0 && data.product_id.length > 0 && data.code.length > 0 && !isNaN(data.price);
  }

  async function sendData(data: Data) {
    const sku = generateSku(data.code, data.size);
    const name = `${data.name}${data.size ? " размер: " + data.size : ""}`.trim();
    console.debug("SEND DATA", data, sku, name);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/amo/good_emplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          sku: sku,
          price: data.price,
          quantity: 0,
        }),
      });

      if (!res.ok) {
        console.error("ERROR");
        alert(
          `${name}\nАртикул: ${sku}\nРазмер: ${data.size ?? "-"}\nЦена: ${
            data.price
          }\n\nРезультат: ❌ ОШИБКА`,
        );
        return;
      }
    } catch (err) {
      console.error("ERROR", err);
      alert(
        `${name}\nАртикул: ${sku}\nРазмер: ${data.size ?? "-"}\nЦена: ${
          data.price
        }\n\nРезультат: ❌ ОШИБКА`,
      );
      return;
    }

    await navigator.clipboard.writeText(sku);
    alert(
      `${name}\nАртикул: ${sku}\nРазмер: ${data.size ?? "-"}\nЦена: ${
        data.price
      }\n\nРезультат: ✅ УСПЕШНО\n\nАртикул скопирован в буфер обмена`,
    );
  }

  $(document).ready(() => {
    const data = parseData();
    if (!data.name || !data.product_id) return;

    $(".productRight .extra_fields").prepend(
      `<div><span class="extra_fields_name">Артикул</span>: <span class="extra_fields_value" id="sku">${generateSku(
        data.code,
        data.size,
      )}</span></div>`,
    );

    $(".productRight .extra_fields").prepend(
      `<div class="button" id="send_data" style="background: #4C8BF7; padding: 4px 20px; margin: 0px 0px 5px 0px; width: 60px; color: white; cursor: pointer; text-align: center">В АМО</div>`,
    );

    $("#send_data").click(async () => {
      const data = parseData();
      if (!data.code) {
        alert("Не указан код товара. Заполните поле «Код» в админке и обновите страницу.");
        return;
      }
      if (!check(data)) return;
      await sendData(data);
    });

    const updateSku = () => {
      const current = parseData();
      $(".extra_fields #sku").text(
        current.code ? generateSku(current.code, current.size) : "Не указан код товара",
      );
    };

    // Delegated events also cover size controls replaced by JoomShopping AJAX.
    document.addEventListener("change", (event) => {
      if ((event.target as Element).matches('[name="jshop_attr_id[2]"]')) updateSku();
    });
    const observer = new MutationObserver(updateSku);
    for (const selector of ["#product_code", "#block_attr_sel_2"]) {
      const element = document.querySelector(selector);
      if (element) observer.observe(element, { childList: true, subtree: true, characterData: true });
    }
    updateSku();

    $(".productRight .extra_fields").append(
      `<div><span class="extra_fields_name" id="name">Название</span>: <span class="extra_fields_value">${data.name}</span></div>`,
    );
  });
})(window["jQuery"] || window["$"]);
