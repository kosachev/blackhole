import { Injectable, Logger } from "@nestjs/common";
import { AMO } from "../amo/amo.constants";
import { AmoService } from "../amo/amo.service";
import type { RequestAddComplex } from "@shevernitskiy/amo/src/api/lead/types";

export type RequestCloneLead = {
  lead_id: number;
  contact_id?: string;
  responsible_id?: string;
  delivery_type?: string;
  index?: string;
  city?: string;
  street?: string;
  building?: string;
  flat?: string;
  pvz?: string;
  tags: number[];
};

@Injectable()
export class CloneLeadService {
  protected readonly logger: Logger = new Logger(CloneLeadService.name);

  constructor(private readonly amo: AmoService) {}

  async handler(data: RequestCloneLead): Promise<{ id: number }> {
    this.logger.log(JSON.stringify(data));

    const custom_fields_values = [];

    const request: RequestAddComplex = {
      name: `Клон сделки ${data.lead_id}`,
      responsible_user_id:
        data.responsible_id && data.responsible_id !== "" ? +data.responsible_id : AMO.USER.ADMIN,
      tags_to_add: data.tags.map((id) => ({ id })),
      _embedded: {},
    };

    if (data.contact_id && data.contact_id !== "") {
      request._embedded.contacts = [{ id: +data.contact_id }];
    }

    if (data.delivery_type && data.delivery_type !== "") {
      custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.DELIVERY_TYPE,
        values: [{ value: data.delivery_type }],
      });
    }

    if (data.index && data.index !== "") {
      custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.INDEX,
        values: [{ value: data.index }],
      });
    }

    if (data.city && data.city !== "") {
      custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.CITY,
        values: [{ value: data.city }],
      });
    }

    if (data.street && data.street !== "") {
      custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.STREET,
        values: [{ value: data.street }],
      });
    }

    if (data.building && data.building !== "") {
      custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.BUILDING,
        values: [{ value: data.building }],
      });
    }

    if (data.flat && data.flat !== "") {
      custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.FLAT,
        values: [{ value: data.flat }],
      });
    }

    if (data.pvz && data.pvz !== "") {
      custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.PVZ,
        values: [{ value: data.pvz }],
      });
    }

    if (custom_fields_values.length > 0) {
      request.custom_fields_values = custom_fields_values;
    }

    const res = await this.amo.client.lead.addComplex([request]);

    return { id: res[0].id };
  }
}
