import { CustomFieldsValue, Embedded, Lead, Tag, Amo } from "@shevernitskiy/amo";
import { RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";

type Options = {
  load_goods?: boolean;
};

// need name and price?
type Good = {
  quantity: number;
};

export class LeadHelper {
  custom_fields: Map<number, string>;
  tags: Set<number>;
  goods: Map<number, Good>;
  old_status_id?: number;
  account_id?: number;

  constructor(
    private readonly client: Amo,
    public lead: Partial<Lead> & { id: number },
    params?: {
      custom_fields?: Map<number, string>;
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
  }

  static async createFromWebhook(client: Amo, data: any, options?: Options) {
    console.log(data.custom_fields);
    const custom_fields = new Map<number, string>(
      data.custom_fields.map((item: CustomFieldsValue) => [
        item.field_id ?? item.id,
        item.values?.at(0)?.value,
      ]),
    );
    const tags = new Set<number>(data.tags?.map((item: Tag) => item.id));
    let goods;
    if (options?.load_goods && data.id) {
      goods = await LeadHelper.loadGoods(data.id, client);
    }

    const old_status_id = data.old_status_id;
    const account_id = data.account_id;
    delete data.old_status_id;
    delete data.account_id;
    delete data.custom_fields;
    delete data.tags;

    return new LeadHelper(client, data, {
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
      ? new Map<number, string>(
          data.custom_fields_values.map((item: CustomFieldsValue) => [
            item.field_id ?? item.id!,
            item.values?.at(0)?.value ?? "unknown",
          ]),
        )
      : new Map<number, string>();
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
      filter: (filter) => filter.single("to_catalog_id", 6969),
    });
    const goods = new Map<number, Good>();
    for (const link of res._embedded.links) {
      goods.set(link.to_entity_id, {
        quantity: link.metadata?.quantity ?? 1,
      });
    }
    return goods;
  }

  toApi = {
    lead: (): Lead => this.lead as Lead,
    customFields: (): CustomFieldsValue[] => {
      return [...this.custom_fields.entries()].map((item) => ({
        id: item[0],
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
      ...this.lead,
      custom_fields_values: this.toApi.customFields(),
      _embedded: {
        tags: this.toApi.tags(),
      },
    }),
  };

  async update(): Promise<any> {
    const reqs: Promise<any>[] = [
      this.client.lead.updateLeadById(this.lead.id, this.toApi.updateLeadRequest()),
    ];
    return Promise.all(reqs);
  }

  async addGood(id: number, good: Good) {
    this.goods.set(id, good);
    this.client.link.addLinksByEntityId(this.lead.id, "leads", [
      {
        to_entity_id: id,
        metadata: { quantity: good.quantity },
      },
    ]);

    throw new Error("Method not implemented.");
  }

  async delGood(id: number) {
    this.goods.delete(id);
    this.client.link.deleteLinksByEntityId(this.lead.id, "leads", [{ to_entity_id: id }]);
  }

  note(text: string[] | string) {
    throw new Error(`Method not implemented. ${text}`);
  }

  task(text: string, responsible_user_id: number) {
    throw new Error(`Method not implemented. ${text} ${responsible_user_id}`);
  }
}
