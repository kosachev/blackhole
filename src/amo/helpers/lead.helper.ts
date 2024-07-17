import { CustomFieldsValue, Lead, Embedded, Tag, Amo } from "@shevernitskiy/amo";
import { RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";
import { AMO } from "../amo.constants";

type Options = {
  load_goods?: boolean;
};

type Good = {
  id: number;
  quantity: number;
  name: string;
  sku: string;
  price: number;
};

export class LeadHelper {
  custom_fields: Map<number, string | number>;
  tags: Set<number>;
  goods: Map<number, Good>;
  old_status_id?: number;
  account_id?: number;

  private constructor(
    private readonly client: Amo,
    public data: Partial<Lead> & { id: number },
    params?: {
      custom_fields?: Map<number, string | number>;
      tags?: Set<number>;
      goods?: Map<number, Good>;
      old_status_id?: number;
      account_id?: number;
    },
  ) {
    this.custom_fields = params?.custom_fields ?? new Map();
    this.tags = params?.tags ?? new Set();
    this.goods = params?.goods ?? new Map();
    this.old_status_id = params?.old_status_id;
    this.account_id = params?.account_id;
    this.data.price = this.data.price ?? 0;
  }

  static async createFromWebhook(client: Amo, data: any, options?: Options) {
    // get the lead data itself from the webhook metadata
    const lead = Object.values(data.leads)[0][0];
    if (!lead) {
      throw new Error("LeadHelper can't parse webhook data");
    }
    const custom_fields = new Map<number, string>(
      lead.custom_fields.map((item: CustomFieldsValue) => [
        item.field_id ?? item.id,
        item.values?.at(0)?.value ?? item.values,
      ]),
    );
    const tags = new Set<number>(lead.tags?.map((item: Tag) => item.id));

    const goods =
      options?.load_goods && lead.id
        ? await LeadHelper.loadGoods(lead.id, client)
        : new Map<number, Good>();

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
      ? new Map<number, string | number>(
          data.custom_fields_values.map((item: CustomFieldsValue) => {
            return [
              item.field_id ?? item.id!,
              (item.values?.at(0)?.value ?? item.values) as string | number,
            ];
          }),
        )
      : new Map<number, string | number>();
    const tags = new Set<number>(data._embedded?.tags?.map((item: Partial<Tag>) => item?.id ?? 0));
    let goods;
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
        sku: "unknown",
        price: 0,
      });
    }
    const cat_els = await client.catalog.getCatalogElementsByCatalogId(AMO.CATALOG.GOODS, {
      filter: (filter) => filter.multi("id", [...goods.keys()]),
    });
    for (const el of cat_els._embedded.elements) {
      const good = goods.get(el.id);
      if (good) {
        good.name = el.name;
        good.sku =
          el.custom_fields_values
            .find((item) => item.field_id == AMO.CATALOG.CUSTOM_FIELD.SKU)
            ?.values?.at(0)
            ?.value?.toString() ?? "unknown";
        good.price =
          parseInt(
            el.custom_fields_values
              .find((item) => item.field_id == AMO.CATALOG.CUSTOM_FIELD.PRICE)
              ?.values?.at(0)
              ?.value.toString(),
          ) ?? 0;
      }
      goods.set(el.id, good);
    }
    return goods;
  }

  private toApi = {
    customFields: (): CustomFieldsValue[] => {
      return [...this.custom_fields.entries()]
        .filter((item) => typeof item[1] === "string" || typeof item[1] === "number") // TODO: fix it, some CF has number[] type (select)
        .map((item) => ({
          field_id: item[0], // field_id not id!
          values: [
            {
              value: item[1],
            },
          ],
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
    this.client.lead.updateLeadById(this.data.id, this.toApi.updateLeadRequest());
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
    return [...this.goods.values()].reduce((a, b) => a + b.price * b.quantity, 0);
  }

  async note(text: string[] | string) {
    const text_arr = Array.isArray(text) ? text : [text];
    await this.client.note.addNotes(
      "leads",
      text_arr.map((text) => ({
        entity_id: this.data.id,
        created_by: AMO.USER.ADMIN,
        note_type: "common",
        params: { text: text },
      })),
    );
  }

  // TODO: think about proper wrapper during implementation
  task(text: string, responsible_user_id: number) {
    throw new Error(`Method not implemented. ${text} ${responsible_user_id}`);
  }
}
