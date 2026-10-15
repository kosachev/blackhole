import { BACKEND_BASE_URL } from "../common";

console.warn("TEMPER MONKEY SCRIPT LOADED");

type TildaProduct = {
  name: string;
  sku: string;
  price: number;
  size: string;
};

function parseData(): TildaProduct {
  const price = +document
    .querySelector("div.js-product-price")
    ?.getAttribute("data-product-price-def");

  return {
    name: document.querySelector('h1[itemprop="name"]')?.textContent?.trim() ?? "",
    sku:
      document
        .querySelector(".t-store__prod-popup__sku .js-store-prod-sku")
        ?.textContent?.trim() ?? "",
    price: isNaN(price) ? 0 : price,

    size:
      // @ts-ignore
      document.querySelector('label.t-product__option-item_active input[name="Размер"]')?.value ??
      "",
  };
}

function addSkuTracker() {
  const span = document.querySelector(".t-store__prod-popup__sku .js-store-prod-sku");
  if (!span) {
    console.error("No span with SKU");
    return;
  }

  let last = span.textContent;

  const observer = new MutationObserver(() => {
    const text = span.textContent;
    if (text !== last) {
      last = text;
      tildaProduct = parseData();

      console.debug("PRODUCT", tildaProduct);
    }
  });

  observer.observe(span, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function addButton() {
  const button = document.createElement("button");
  button.textContent = "В АМО";
  button.classList.add("button-input", "t-store__prod-popup__btn", "t-btn", "t-btn_sm");
  button.style =
    "color:#ffffff;background-color:#4C8BF7;border-radius:0px;-moz-border-radius:0px;-webkit-border-radius:0px;font-family:Manrope;font-weight:500;";

  button.addEventListener("click", async () => {
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = "Отправка…";
    try {
      await sendData();
    } finally {
      button.disabled = false;
      button.textContent = "В АМО";
    }
  });

  const addToBasket = document.querySelector(
    'div.t-store__prod-popup__btn-wrapper[tt="Добавить в корзину"]',
  );

  if (addToBasket) {
    addToBasket.appendChild(button);
  }
}

async function sendData(): Promise<void> {
  console.debug("SEND DATA", tildaProduct);

  if (
    !tildaProduct.sku ||
    !tildaProduct.name ||
    isNaN(tildaProduct.price) ||
    tildaProduct.price === 0
  ) {
    alert(tildaProductToString(tildaProduct, false));
    return;
  }

  const product = {
    ...tildaProduct,
    name: tildaProduct.size
      ? `${tildaProduct.name} размер: ${tildaProduct.size}`
      : tildaProduct.name,
  };

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/amo/good_emplace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: 0,
      }),
    });

    if (!res.ok) {
      console.error("ERROR");
      alert(tildaProductToString(product, false));
      return;
    }
  } catch (err) {
    console.error("ERROR", err);
    alert(tildaProductToString(product, false));
    return;
  }

  await navigator.clipboard.writeText(product.sku);
  alert(tildaProductToString(product, true));
}

function tildaProductToString({ name, sku, price }: TildaProduct, result?: boolean): string {
  return `${name}\nАртикул: ${sku}\nЦена: ${price}${
    result === false
      ? "\n\nРезультат: ❌ ОШИБКА"
      : result === true
      ? "\n\nРезультат: ✅ УСПЕШНО\n\nАртикул скопирован в буфер обмена"
      : ""
  }`;
}

let tildaProduct = parseData();
console.debug("PRODUCT", tildaProduct);
addSkuTracker();
addButton();
