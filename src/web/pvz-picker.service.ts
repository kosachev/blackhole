import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { AMO } from "../amo/amo.constants";
import { AmoService } from "../amo/amo.service";
import { CdekService } from "../cdek/cdek.service";

export type RequestPVZPicker = {
  lead_id: number;
  code: string;
  index: string;
  city: string;
  city_code: number;
  street: string;
  building: string;
};

@Injectable()
export class PVZPickerService {
  constructor(
    private readonly amo: AmoService,
    private readonly cdek: CdekService,
  ) {}

  async handler(data: RequestPVZPicker) {
    await Promise.all([
      this.amo.client.lead.updateLeadById(data.lead_id, {
        custom_fields_values: [
          {
            field_id: AMO.CUSTOM_FIELD.CITY,
            values: [{ value: data.city }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.STREET,
            values: [{ value: data.street }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.BUILDING,
            values: [{ value: data.building }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.FLAT,
            values: [{ value: `пвз` }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.PVZ,
            values: [{ value: `${data.code}` }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.INDEX,
            values: [{ value: data.index }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.CDEK_CITY_ID,
            values: [{ value: `${data.city_code}` }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.DELIVERY_TARIFF,
            values: [{ value: "Склад - Склад" }],
          },
        ],
      }),
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          created_by: AMO.USER.ADMIN,
          note_type: "common",
          params: {
            text: `✎ СДЭК: выбрана доставка до ПВЗ ${data.code}, ${data.city}, ${data.street}, ${data.building}, ${data.index}`,
          },
        },
      ]),
    ]);
  }

  async getPVZList(index: number) {
    const result = await this.cdek.client.getPickupPoints({
      postal_code: index,
    });
    if (result === null) {
      throw new InternalServerErrorException("CDEK: Unable to fetch cdek offices failed");
    }
    return result;
  }
}
