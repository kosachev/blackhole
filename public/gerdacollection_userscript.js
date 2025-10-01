// client/common.ts
var BACKEND_BASE_URL = "http://localhost:6969";

// client/gerdacollection.ts
console.warn("TEMPER MONKEY SCRIPT LOADED");
function parseData() {
  const price = +document.querySelector("div.js-product-price")?.getAttribute("data-product-price-def");
  return {
    name: document.querySelector('h1[itemprop="name"]')?.textContent?.trim() ?? "",
    sku: document.querySelector('span.js-store-prod-sku[itemprop="sku"]')?.textContent?.trim() ?? "",
    price: isNaN(price) ? 0 : price,
    size: (
      // @ts-ignore
      document.querySelector('label.t-product__option-item_active input[name="\u0420\u0430\u0437\u043C\u0435\u0440"]')?.value ?? ""
    )
  };
}
function addSkuTracker() {
  const span = document.querySelector('span.js-store-prod-sku[itemprop="sku"]');
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
    subtree: true
  });
}
function addButton() {
  const button = document.createElement("button");
  button.textContent = "\u0412 \u0410\u041C\u041E";
  button.classList.add("button-input", "t-store__prod-popup__btn", "t-btn", "t-btn_sm");
  button.style = "color:#ffffff;background-color:#4C8BF7;border-radius:0px;-moz-border-radius:0px;-webkit-border-radius:0px;font-family:Manrope;font-weight:500;";
  button.addEventListener("click", async () => {
    await sendData();
  });
  const addToBasket = document.querySelector(
    'div.t-store__prod-popup__btn-wrapper[tt="\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443"]'
  );
  if (addToBasket) {
    addToBasket.appendChild(button);
  }
}
async function sendData() {
  console.debug("SEND DATA", tildaProduct);
  if (!tildaProduct.sku || !tildaProduct.name || isNaN(tildaProduct.price) || tildaProduct.price === 0) {
    alert(tildaProductToString(tildaProduct, false));
    return;
  }
  if (tildaProduct.size && tildaProduct.size.length > 0) {
    tildaProduct.name += " \u0440\u0430\u0437\u043C\u0435\u0440: " + tildaProduct.size;
  }
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/amo/good_emplace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tildaProduct.name,
        sku: tildaProduct.sku,
        price: tildaProduct.price,
        quantity: 0
      })
    });
    if (!res.ok) {
      console.error("ERROR");
      alert(tildaProductToString(tildaProduct, false));
      return;
    }
  } catch (err) {
    console.error("ERROR", err);
    alert(tildaProductToString(tildaProduct, false));
    return;
  }
  await navigator.clipboard.writeText(tildaProduct.sku);
  alert(tildaProductToString(tildaProduct, true));
}
function tildaProductToString({ name, sku, price }, result) {
  return `${name}
\u0410\u0440\u0442\u0438\u043A\u0443\u043B: ${sku}
\u0426\u0435\u043D\u0430: ${price}${result === false ? "\n\n\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442: \u274C \u041E\u0428\u0418\u0411\u041A\u0410" : result === true ? "\n\n\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442: \u2705 \u0423\u0421\u041F\u0415\u0428\u041D\u041E\n\n\u0410\u0440\u0442\u0438\u043A\u0443\u043B \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D \u0432 \u0431\u0443\u0444\u0435\u0440 \u043E\u0431\u043C\u0435\u043D\u0430" : ""}`;
}
var tildaProduct = parseData();
console.debug("PRODUCT", tildaProduct);
addSkuTracker();
addButton();
