import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { EntityLink } from "@shevernitskiy/amo";
import { AMO } from "../amo/amo.constants";
import { AmoService } from "../amo/amo.service";

type CustomField = {
  field_id: number;
  value: string;
};
type CatalogElement = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

export type RequestPartialReturn = {
  lead_id: number;
  contact_id?: number;
  catalog_id: number;
  custom_fields: CustomField[];
  sold: CatalogElement[];
  return: CatalogElement[];
};

@Injectable()
export class PartialReturnService {
  protected readonly logger: Logger = new Logger(PartialReturnService.name);

  constructor(private readonly amo: AmoService) {}

  async handler(data: RequestPartialReturn) {
    if (data.sold.length > 0 && data.return.length === 0) {
      return this.allSold(data);
    }
    if (data.return.length > 0 && data.sold.length === 0) {
      return this.allReturn(data);
    }
    return this.partial(data);
  }

  async allSold(data: RequestPartialReturn) {
    await Promise.all([
      this.amo.client.lead.updateLeadById(data.lead_id, {
        status_id: AMO.STATUS.SUCCESS,
      }),
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: { text: "✔ Сделка переведена в реализованные" },
        },
      ]),
    ]);

    this.logger.log(`USERSCRIPT_SOLD, lead_id: ${data.lead_id}`);
  }

  async allReturn(data: RequestPartialReturn) {
    await Promise.all([
      this.amo.client.lead.updateLeadById(data.lead_id, {
        status_id: AMO.STATUS.RETURN,
        _embedded: {
          tags: [{ id: AMO.TAG.RETURN }],
        },
      }),
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: { text: "⇌ Сделка переведена в возвраты" },
        },
      ]),
    ]);

    this.logger.log(`USERSCRIPT_RETURN, lead_id: ${data.lead_id}`);
  }

  async partial(data: RequestPartialReturn) {
    const return_lead = await this.amo.client.lead.addLeads([
      {
        status_id: AMO.STATUS.RETURN,
        name: `Частичный возврат по сделке ${data.lead_id}`,
        price: data.return.reduce((acc, item) => acc + item.price, 0),
        custom_fields_values: data.custom_fields.map((item) => ({
          field_id: item.field_id,
          values: [{ value: item.value }],
        })),
        _embedded: {
          contacts: [{ id: data.contact_id }],
          tags: [{ id: AMO.TAG.PARTIAL_RETURN }],
        },
      },
    ]);

    if (!return_lead) throw new InternalServerErrorException("Unable to crate return lead");

    const return_lead_id = return_lead._embedded.leads[0].id;
    const return_goods_links: Partial<EntityLink>[] = data.return.map((item) => ({
      to_entity_id: item.id,
      to_entity_type: "catalog_elements",
      metadata: {
        catalog_id: data.catalog_id,
      },
    }));

    const direct_track = data.custom_fields.find(
      (item) => item.field_id === AMO.CUSTOM_FIELD.TRACK_NUMBER,
    ).value;

    await Promise.all([
      this.amo.client.link.deleteLinksByEntityId(data.lead_id, "leads", return_goods_links),
      this.amo.client.link.addLinksByEntityId(return_lead_id, "leads", return_goods_links),
      this.amo.client.lead.updateLeadById(data.lead_id, {
        status_id: AMO.STATUS.SUCCESS,
        price: data.sold.reduce((acc, item) => acc + item.price, 0),
        tags_to_add: [{ id: AMO.TAG.PARTIAL_RETURN }],
      }),
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: {
            text: `✔ Сделка переведена в реализованные, частичный возврат по ссылке https://gerda.amocrm.ru/leads/detail/${return_lead_id}`,
          },
        },
        {
          entity_id: return_lead_id,
          note_type: "common",
          params: {
            text: `⇌ Частичный возврат по сделке ${data.lead_id}, ссылка https://gerda.amocrm.ru/leads/detail/${data.lead_id}${direct_track ? ", прямая накладная " + direct_track : ""}`,
          },
        },
      ]),
    ]);

    this.logger.log(
      `USERSCRIPT_PARTIAL_RETURN, direct_id: ${data.lead_id}, return_id: ${return_lead_id}`,
    );
  }
}
