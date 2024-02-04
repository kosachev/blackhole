import { CustomFieldsValue, Embedded, Lead, Tag } from "@shevernitskiy/amo";
import { RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";

export abstract class AbstractLeadHelper {
  lead: Partial<Lead>;
  protected abstract custom_fields: Map<number, string>;
  protected abstract tags: Set<number>;

  constructor(private data: any) {
    this.lead = data;
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
}

export class WebhookLeadHelper extends AbstractLeadHelper {
  readonly old_status_id?: number;
  readonly account_id?: number;
  protected custom_fields: Map<number, string>;
  protected tags: Set<number>;

  constructor(data: any) {
    super(data);

    this.old_status_id = data.old_status_id;
    this.account_id = data.account_id;

    this.custom_fields = new Map<number, string>(
      data.custom_fields.map((item: CustomFieldsValue) => [
        item.field_id ?? item.id,
        item.values?.at(0)?.value,
      ]),
    );
    this.tags = new Set<number>(data.tags?.map((item: Tag) => item.id));
  }
}

export class ApiLeadHelper extends AbstractLeadHelper {
  readonly account_id?: number;
  protected custom_fields: Map<number, string>;
  protected tags: Set<number>;

  constructor(
    data: Lead &
      Pick<Embedded, "loss_reason" | "tags" | "contacts" | "companies" | "catalog_elements">,
  ) {
    super(data);

    this.custom_fields = data.custom_fields_values
      ? new Map<number, string>(
          data.custom_fields_values.map((item: CustomFieldsValue) => [
            item.field_id ?? item.id ?? 0,
            item.values?.at(0)?.value ?? "",
          ]),
        )
      : new Map<number, string>();

    this.tags = new Set<number>(data.tags?.map((item: Partial<Tag>) => item?.id ?? 0));
  }
}
