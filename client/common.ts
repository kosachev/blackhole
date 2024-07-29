import { AMO } from "../src/amo/amo.constants";

export function CFV(field_id: number): JQuery<HTMLElement> {
  return $(`input[name="CFV[${field_id}]"]`);
}

export function validateIndexCf(): boolean {
  const index = CFV(AMO.CUSTOM_FIELD.INDEX).val();
  return !(!index || isNaN(Number(index)) || Number(index) > 999999 || Number(index) < 100000);
}

export function deliveryType(): string {
  return $(`div[data-id="${AMO.CUSTOM_FIELD.DELIVERY_TYPE}"] > div > div > button`).text().trim();
}

export function deliveryTariff(): string {
  return $(`div[data-id="${AMO.CUSTOM_FIELD.DELIVERY_TARIFF}"] > div > div > button`).text().trim();
}

export type Good = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

export async function leadGoods(lead_id: number): Promise<Good[]> {
  const res = await fetch(
    `https://gerda.amocrm.ru/ajax/leads/${lead_id}/catalog/${AMO.CATALOG.GOODS}/elements?before_id=0&before_created_at=0&limit=50&with=catalog_element`,
    {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: `https://gerda.amocrm.ru/leads/detail/${lead_id}?tab_id=${AMO.CATALOG.GOODS}`,
        "X-Requested-With": "XMLHttpRequest",
      },
    },
  );

  if (!res.ok) {
    console.error("Unable to fethc goods from lead", lead_id);
    return [];
  }
  if (res.status === 204) return []; // no goods in lead
  const data = await res.json();

  return data._embedded.links.map((item) => ({
    id: item.to_entity_id,
    name: item._embedded.catalog_element.name,
    quantity: item.metadata.quantity,
    price: +item._embedded.catalog_element.custom_fields.find(
      (field) => field.id === AMO.CATALOG.CUSTOM_FIELD.PRICE,
    )?.values[0].value,
    weight: +(
      (
        item._embedded.catalog_element.custom_fields.find(
          (field) => field.id === AMO.CATALOG.CUSTOM_FIELD.WEIGHT,
        )?.values[0].value ?? 1000
      ) // NOTE: default weight 1000 gramm if not exist
    ),
    sku: item._embedded.catalog_element.custom_fields.find(
      (field) => field.id === AMO.CATALOG.CUSTOM_FIELD.SKU,
    )?.values[0].value,
  }));
}

export function leadDiscount(price: number): number {
  let abs_discount = 0;
  let discount = $('div[data-id="1376070"]').find("button").text().trim() ?? "0";

  if (discount === "Выбрать") {
    discount = "0";
  }

  if (discount.includes("%")) {
    abs_discount = price * (+discount.replace("%", "") / 100);
  } else {
    abs_discount = +discount;
  }

  return abs_discount;
}

export async function setLeadPrice(
  lead_id: number,
  pipeline_id: number | string,
  status_id: number | string,
  price: number | string,
) {
  const form = new FormData();
  form.append("lead[PRICE]", price.toString());
  form.append("lead[STATUS]", status_id.toString());
  form.append("lead[PIPELINE_ID]", pipeline_id.toString());
  form.append("ID", lead_id.toString());

  await fetch(`https://gerda.amocrm.ru/ajax/leads/detail/`, {
    method: "POST",
    body: form,
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: `https://gerda.amocrm.ru/leads/detail/${lead_id}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });
}

export const BACKEND_BASE_URL = process.env.BACKEND_BASE;
