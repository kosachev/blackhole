import { BACKEND_BASE_URL } from "./common";

console.warn("TEMPER MONKEY SCRIPT LOADED");

type Data = {
  name: string;
  product_id: string;
  category_id: string;
  size: string;
  price: number;
};

(($: JQueryStatic) => {
  function parseData(): Data {
    $('input[name="jshop_attr_id[2]"]');
    let size: string;
    const sizes = document.querySelectorAll('input[name="jshop_attr_id[2]"]').values();
    for (const item of sizes) {
      if ((item as any).checked === true) {
        size = $(`#${item.id}`).next()?.text();
      }
    }

    return {
      name: $("#name_product")?.text()?.trim(),
      product_id: ($("input#product_id")?.val() as string) ?? "",
      category_id: ($("input#category_id")?.val() as string) ?? "",
      size: size ?? "",
      price: Number($("span.prod_price_span")?.text()?.replaceAll(" ", "").trim() ?? "0"),
    };
  }

  function generateSku(category_id: string, product_id: string, size: string): string {
    return `${category_id.padStart(3, "0")}${product_id.padStart(6, "0")}${size.padStart(3, "0")}`;
  }

  function check(data: Data): boolean {
    return data.name.length > 0 && data.product_id.length > 0 && !isNaN(data.price);
  }

  async function sendData(data: Data) {
    const sku = generateSku(data.category_id, data.product_id, data.size);
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
          `${name}\nАртикул: ${sku}\nРазмер: ${data.size ?? "-"}\nЦена: ${data.price}\n\nРезультат: ❌ ОШИБКА`,
        );
        return;
      }
    } catch (err) {
      console.error("ERROR", err);
      alert(
        `${name}\nАртикул: ${sku}\nРазмер: ${data.size ?? "-"}\nЦена: ${data.price}\n\nРезультат: ❌ ОШИБКА`,
      );
      return;
    }

    await navigator.clipboard.writeText(sku);
    alert(
      `${name}\nАртикул: ${sku}\nРазмер: ${data.size ?? "-"}\nЦена: ${data.price}\n\nРезультат: ✅ УСПЕШНО\n\nАртикул скопирован в буфер обмена`,
    );
  }

  $(document).ready(() => {
    const data = parseData();
    if (!check(data)) return;

    $(".productRight .extra_fields").prepend(
      `<div><span class="extra_fields_name">Артикул</span>: <span class="extra_fields_value" id="sku">${generateSku(data.category_id, data.product_id, data.size)}</span></div>`,
    );

    $(".productRight .extra_fields").prepend(
      `<div class="button" id="send_data" style="background: #4C8BF7; padding: 4px 20px; margin: 0px 0px 5px 0px; width: 60px; color: white; cursor: pointer; text-align: center">В АМО</div>`,
    );

    $("#send_data").click(async () => {
      const data = parseData();
      if (!check(data)) return;
      await sendData(data);
    });

    $('.productRight input[name="jshop_attr_id[2]"]').click((el) => {
      const size = (el.target as HTMLInputElement).labels[0]?.textContent;
      if (size && size.length > 0) {
        $(".extra_fields #sku").text(generateSku(data.category_id, data.product_id, size));
      }
    });

    $(".productRight .extra_fields").append(
      `<div><span class="extra_fields_name" id="name>Название</span>: <span class="extra_fields_value">${data.name}</span></div>`,
    );
  });
})(window["jQuery"].noConflict(true));
