import { CustomFieldsValue, Lead, Embedded, Tag, Amo } from "@shevernitskiy/amo";
import { RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";
import { AMO } from "../amo.constants";

type Options = {
  load_goods?: boolean;
  load_contact?: boolean;
};

type Good = {
  id: number;
  quantity: number;
  name: string;
  sku?: string;
  price: number;
  weight?: number;
};

const fields_to_convert = [
  "id",
  "status_id",
  "price",
  "responsible_user_id",
  "last_modified",
  "modified_user_id",
  "created_user_id",
  "date_create",
  "pipeline_id",
  "created_at",
  "updated_at",
  "account_id",
] as const;

type Contact = {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  custom_fields: Map<number, string>;
};

enum CdekTariff {
  OFFICE_TO_OFFICE = 136,
  OFFICE_TO_DOOR = 137,
  DOOR_TO_OFFICE = 138,
  DOOR_TO_DOOR = 139,
  ECONOMY_DOOR_TO_DOOR = 231,
  ECONOMY_DOOR_TO_OFFICE = 232,
  ECONOMY_OFFICE_TO_DOOR = 233,
  ECONOMY_OFFICE_TO_OFFICE = 234,
}

export class LeadHelper {
  private notes: string[] = [];
  public errors: string[] = [];
  public warnings: string[] = [];
  to_save = false;

  custom_fields: Map<number, string>;
  tags: Set<number>;
  goods: Map<number, Good>;
  contact: Contact;
  old_status_id?: number;
  account_id?: number;

  private constructor(
    private readonly client: Amo,
    public data: Partial<Lead> & { id: number },
    params?: {
      custom_fields?: Map<number, string>;
      tags?: Set<number>;
      goods?: Map<number, Good>;
      contact?: Contact;
      old_status_id?: number;
      account_id?: number;
    },
  ) {
    this.custom_fields = params?.custom_fields ?? new Map();
    this.tags = params?.tags ?? new Set();
    this.goods = params?.goods ?? new Map();
    this.contact = params?.contact ?? {
      name: "",
      id: 0,
      first_name: "",
      last_name: "",
      custom_fields: new Map(),
    };
    this.old_status_id = params?.old_status_id;
    this.account_id = params?.account_id;
    this.data = LeadHelper.convertFieldsToNumber(data);
    this.data.price = this.data.price ?? 0;

    this.proxify(this);
  }

  private proxify(instance: this) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const handler: ProxyHandler<any> = {
      get(target, key) {
        if (typeof target[key] === "object" && target[key] !== null) {
          return new Proxy(target[key], handler);
        }
        if (typeof target[key] === "function") {
          return (...args: unknown[]) => {
            if (
              ["set", "add", "delete", "clear", "push", "pop", "shift", "unshift", "set"].includes(
                key.toString(),
              )
            ) {
              instance.to_save = true;
            }
            return target[key](...args);
          };
        }
        return target[key];
      },
      set(target, prop: string, value) {
        instance.to_save = true;
        target[prop] = value;
        return true;
      },
    };

    instance.data = new Proxy(instance.data, handler);
    instance.goods = new Proxy(instance.goods, handler);
    instance.custom_fields = new Proxy(instance.custom_fields, handler);
    instance.tags = new Proxy(instance.tags, handler);
  }

  private static convertFieldsToNumber(data: any) {
    for (const item of Object.entries(data)) {
      if (fields_to_convert.includes(item[0] as any)) {
        data[item[0] as any] = +item[1];
      }
    }
    return data;
  }

  static async createFromWebhook(client: Amo, data: any, options?: Options) {
    // get the lead data itself from the webhook metadata
    const lead = Object.values(data.leads)[0][0];
    if (!lead) {
      throw new Error("LeadHelper can't parse webhook data");
    }
    const custom_fields = new Map<number, string>(
      lead.custom_fields?.map((item: CustomFieldsValue) => {
        if (
          item.field_id == AMO.CUSTOM_FIELD.DELIVERY_TIME ||
          item.id == AMO.CUSTOM_FIELD.DELIVERY_TIME
        ) {
          return [
            Number(item.field_id ?? item.id!),
            LeadHelper.deliveryIntervalToString(item.values as { value: string }[]),
          ];
        }
        return [+(item.field_id ?? item.id), item.values?.at(0)?.value ?? item.values];
      }),
    );
    const tags = new Set<number>(lead.tags?.map((item: Tag) => +item.id));

    const goods =
      options?.load_goods && lead.id
        ? await LeadHelper.loadGoods(lead.id, client)
        : new Map<number, Good>();

    const contact =
      options?.load_contact && lead.id ? await LeadHelper.loadContact(lead.id, client) : undefined;

    const old_status_id = lead.old_status_id;
    const account_id = lead.account_id;
    delete lead.old_status_id;
    delete lead.account_id;
    delete lead.custom_fields;
    delete lead.tags;

    return new LeadHelper(client, lead, {
      custom_fields,
      tags,
      goods,
      contact,
      old_status_id,
      account_id,
    });
  }

  static async createFromApi(
    client: Amo,
    data: Partial<Lead> & { id: number } & {
      _embedded?: Pick<
        Embedded,
        "loss_reason" | "tags" | "contacts" | "companies" | "catalog_elements"
      >;
    },
    options?: Options,
  ) {
    const custom_fields = data.custom_fields_values
      ? new Map<number, string>(
          data.custom_fields_values.map((item: CustomFieldsValue) => {
            if (
              item.field_id == AMO.CUSTOM_FIELD.DELIVERY_TIME ||
              item.id == AMO.CUSTOM_FIELD.DELIVERY_TIME
            ) {
              return [
                Number(item.field_id ?? item.id!),
                LeadHelper.deliveryIntervalToString(item.values as { value: string }[]),
              ];
            }
            return [
              item.field_id ?? item.id!,
              (item.values?.at(0)?.value as string) ?? (item.values.join(", ") as string),
            ];
          }),
        )
      : new Map<number, string>();
    const tags = new Set<number>(data._embedded?.tags?.map((item: Partial<Tag>) => item?.id ?? 0));
    let goods: Map<number, Good> = new Map<number, Good>();
    if (options?.load_goods && data.id) {
      goods = await LeadHelper.loadGoods(data.id, client);
    }

    delete data._embedded;

    return new LeadHelper(client, data, {
      custom_fields,
      tags,
      goods,
    });
  }

  static async createFromId(client: Amo, id: number, options?: Options) {
    const data = await client.lead.getLeadById(id, {
      with: [
        "catalog_elements",
        "is_price_modified_by_robot",
        "loss_reason",
        "contacts",
        "only_deleted",
        "source_id",
      ],
    });
    return LeadHelper.createFromApi(client, data, options);
  }

  private static async loadContact(id: number, client: Amo): Promise<Contact> {
    const lead_info = await client.lead.getLeadById(id, {
      with: ["contacts"],
    });
    const contact_id = lead_info._embedded.contacts.find((item) => item.is_main === true)?.id;
    if (!contact_id) {
      throw new Error(`LeadHelper can't fetch contact of the lead ${id}`);
    }

    const contact = await client.contact.getContactById(contact_id);
    const custom_fields = new Map<number, string>(
      contact.custom_fields_values?.map((item) => [
        item.field_id ?? item.id,
        item.values?.at(0)?.value as string,
      ]),
    );

    return {
      id: contact.id,
      name: contact.name,
      first_name: contact.first_name,
      last_name: contact.last_name,
      custom_fields: custom_fields,
    };
  }

  private static async loadGoods(id: number, client: Amo): Promise<Map<number, Good>> {
    const res = await client.link.getLinksByEntityId(id, "leads", {
      // TODO: remove hardcoded catalog id
      filter: (filter) => filter.single("to_catalog_id", AMO.CATALOG.GOODS),
    });
    const goods = new Map<number, Good>();
    for (const link of res._embedded.links) {
      goods.set(link.to_entity_id, {
        id: link.to_entity_id,
        quantity: link.metadata?.quantity ?? 1,
        name: "unknown",
        price: 0,
      });
    }
    if (goods.size === 0) {
      return goods;
    }
    const cat_els = await client.catalog.getCatalogElementsByCatalogId(AMO.CATALOG.GOODS, {
      filter: (filter) => filter.multi("id", [...goods.keys()]),
    });
    for (const el of cat_els._embedded.elements) {
      const good = goods.get(el.id);
      if (good) {
        const weight = parseInt(
          el.custom_fields_values
            .find((item) => item.field_id == AMO.CATALOG.CUSTOM_FIELD.WEIGHT)
            ?.values?.at(0)
            ?.value.toString(),
        );
        good.name = el.name;
        good.sku =
          el.custom_fields_values
            .find((item) => item.field_id == AMO.CATALOG.CUSTOM_FIELD.SKU)
            ?.values?.at(0)
            ?.value?.toString() ?? undefined;
        good.price =
          parseInt(
            el.custom_fields_values
              .find((item) => item.field_id == AMO.CATALOG.CUSTOM_FIELD.PRICE)
              ?.values?.at(0)
              ?.value.toString(),
          ) ?? 0;
        good.weight = isNaN(weight) ? undefined : weight;
      }
      goods.set(el.id, good);
    }
    return goods;
  }

  private toApi = {
    customFields: (): CustomFieldsValue[] => {
      return [...this.custom_fields.entries()]
        .filter(
          (item) =>
            item[0] !== AMO.CUSTOM_FIELD.DELIVERY_TIME && item[0] !== AMO.CUSTOM_FIELD.FULLPAY,
        )
        .map(([id, value]) => ({
          field_id: id, // field_id not id!
          values:
            value === undefined || value === null
              ? null
              : [{ value: Array.isArray(value) ? +value[0] : value }],
        }));
    },
    tags: (): Pick<Tag, "id">[] => {
      return [...this.tags.values()].map((item) => ({ id: item }));
    },
    updateLeadRequest: (): RequestUpdateLead => ({
      ...this.data,
      custom_fields_values: this.toApi.customFields(),
      _embedded: {
        tags: this.toApi.tags(),
      },
    }),
  };

  async saveToAmo() {
    const promises: Promise<unknown>[] = [];
    if (this.to_save) {
      promises.push(this.client.lead.updateLeadById(this.data.id, this.toApi.updateLeadRequest()));
    }
    if (this.notes.length > 0) {
      promises.push(
        this.client.note.addNotes(
          "leads",
          this.notes.map((text) => ({
            entity_id: this.data.id,
            created_by: AMO.USER.ADMIN,
            note_type: "common",
            params: { text: text },
          })),
        ),
      );
    }

    return await Promise.all(promises);
  }

  async addGoods(goods: { id: number; quantity: number }[]) {
    await this.client.link.addLinksByEntityId(
      this.data.id,
      "leads",
      goods.map((item) => ({
        to_entity_id: item.id,
        to_entity_type: "catalog_elements",
        metadata: { quantity: item.quantity, catalog_id: AMO.CATALOG.GOODS },
      })),
    );

    // TODO: bad, should be tracked by instance as well to eliminate double loading
    this.goods = await LeadHelper.loadGoods(this.data.id, this.client);
    this.data.price = this.totalPrice();
  }

  async delGoods(goods_id: number[]) {
    // return if no goods in the map with at least one of the ids
    const valid_ids = goods_id.filter((id) => this.goods.delete(id));
    if (valid_ids.length == 0) {
      return;
    }

    await this.client.link.deleteLinksByEntityId(
      this.data.id,
      "leads",
      valid_ids.map((id) => ({
        to_entity_id: id,
        to_entity_type: "catalog_elements",
        metadata: { catalog_id: AMO.CATALOG.GOODS },
      })),
    );
    this.data.price = this.totalPrice();
  }

  totalPrice(): number {
    return [...this.goods.values()].reduce((a, b) => a + (b.price ?? 0) * (b.quantity ?? 0), 0);
  }

  note(text: string[] | string) {
    const text_arr = Array.isArray(text) ? text : [text];
    this.notes = [...this.notes, ...text_arr];
  }

  error(text: string[] | string) {
    const text_arr = Array.isArray(text) ? text : [text];
    this.errors = [...this.errors, ...text_arr];
  }

  warning(text: string[] | string) {
    const text_arr = Array.isArray(text) ? text : [text];
    this.warnings = [...this.warnings, ...text_arr];
  }

  // TODO: think about proper wrapper during implementation
  task(text: string, responsible_user_id: number) {
    throw new Error(`Method not implemented. ${text} ${responsible_user_id}`);
  }

  async step(fn: (lead: LeadHelper) => void | Promise<void>) {
    fn(this);
  }

  getAbsoluteDiscount(): number {
    let abs_discount = 0;
    if (this.custom_fields.has(AMO.CUSTOM_FIELD.DISCOUNT)) {
      const discount = this.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT).toString();
      if (discount.includes("%")) {
        abs_discount = this.data.price * (+discount.replace("%", "") / 100);
      } else {
        abs_discount = +discount;
      }
    }
    return abs_discount;
  }

  getFullAddress(with_index = false): string {
    return [
      with_index ? this.custom_fields.get(AMO.CUSTOM_FIELD.INDEX) : undefined,
      this.custom_fields.get(AMO.CUSTOM_FIELD.CITY),
      this.custom_fields.get(AMO.CUSTOM_FIELD.STREET),
      this.custom_fields.get(AMO.CUSTOM_FIELD.BUILDING),
      this.custom_fields.get(AMO.CUSTOM_FIELD.FLAT),
    ]
      .filter((item) => item)
      .join(", ");
  }

  getStripedPhone(): string {
    let phone = (this.contact.custom_fields.get(AMO.CONTACT.PHONE) ?? "")
      .replaceAll(" ", "")
      .replaceAll("-", "")
      .replaceAll("(", "")
      .replaceAll(")", "")
      .replaceAll("+", "");
    if (!phone.startsWith("9")) phone = phone.slice(1);
    return phone;
  }

  parseTariff(): number {
    switch (this.custom_fields.get(AMO.CUSTOM_FIELD.DELIVERY_TARIFF)) {
      case "Дверь - Дверь":
        return CdekTariff.DOOR_TO_DOOR;
      case "Дверь - Склад":
        return CdekTariff.DOOR_TO_OFFICE;
      case "Склад - Дверь":
        return CdekTariff.OFFICE_TO_DOOR;
      case "Склад - Склад":
        return CdekTariff.OFFICE_TO_OFFICE;
      case "Дверь - Дверь эконом":
        return CdekTariff.ECONOMY_DOOR_TO_DOOR;
      case "Дверь - Склад эконом":
        return CdekTariff.ECONOMY_DOOR_TO_OFFICE;
      case "Склад - Дверь эконом":
        return CdekTariff.ECONOMY_OFFICE_TO_DOOR;
      case "Склад - Склад эконом":
        return CdekTariff.ECONOMY_OFFICE_TO_OFFICE;
      default:
        return undefined;
    }
  }

  getDiscountMultiplyier(): number {
    const discount = Number(
      ((this.custom_fields.get(AMO.CUSTOM_FIELD.DISCOUNT) as string) ?? "").replaceAll("%", ""),
    );
    return isNaN(discount) ? 1 : discount > 100 ? 1 : (100 - discount) / 100;
  }

  static deliveryIntervalToString(data: { value: string }[]): string {
    data.sort((a, b) => a.value.split(" - ")[0].localeCompare(b.value.split(" - ")[0]));

    const result = [];
    let prev: [string, string] = ["", ""];

    for (const { value } of data) {
      const [start, end] = value.split(" - ");
      if (prev[0] === "" && prev[1] === "") {
        prev = [start, end];
        continue;
      }
      if (prev[1] === start) {
        prev[1] = end;
        continue;
      } else {
        if (prev[0] !== "" && prev[1] !== "") {
          result.push(`${prev[0]} - ${prev[1]}`);
        }
        prev = [start, end];
      }
    }
    if (prev[0] !== "" && prev[1] !== "") {
      result.push(`${prev[0]} - ${prev[1]}`);
    }

    return result.join(", ");
  }
}
