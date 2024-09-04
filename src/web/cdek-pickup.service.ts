import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { AMO } from "../amo/amo.constants";
import { AmoService } from "../amo/amo.service";
import { CdekService } from "../cdek/cdek.service";

export type RequestCdekPickup = {
  lead_id: number;
  track_code: string;
  uuid: string;
  intake_date: string;
  intake_time: string;
};

@Injectable()
export class CdekPickupService {
  protected readonly logger: Logger = new Logger(CdekPickupService.name);

  constructor(
    private readonly amo: AmoService,
    private readonly cdek: CdekService,
  ) {}

  async handler(data: RequestCdekPickup) {
    const start_time = +data.intake_time.split(":")[0];

    const result = await this.cdek.client.addCourier({
      order_uuid: data.uuid,
      cdek_number: +data.track_code,
      intake_date: data.intake_date,
      intake_time_from: `${start_time}:00`,
      intake_time_to: `${start_time + 3}:00`,
    });

    if (result === null) {
      await this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: {
            text: `✖ СДЕК: не удалось вызвать курьера, ошибка сдек api`,
          },
        },
      ]);
      throw new InternalServerErrorException("CDEK: cdekPickup failed");
    }

    await Promise.all([
      this.amo.client.lead.updateLeadById(data.lead_id, {
        custom_fields_values: [
          { field_id: AMO.CUSTOM_FIELD.COURIER_CALLED, values: [{ value: "да" }] },
          {
            field_id: AMO.CUSTOM_FIELD.COURIER_PICKUP_DATE,
            values: [{ value: new Date(data.intake_date).getTime() / 1000 }],
          },
          {
            field_id: AMO.CUSTOM_FIELD.COURIER_PICKUP_TIME,
            values: [{ value: `${start_time}:00` }],
          },
        ],
      }),
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: {
            text: `✔ СДЕК: Курьер вызван на ${data.intake_date}, время ${start_time}:00-${start_time + 3}:00`,
          },
        },
      ]),
    ]);

    this.logger.log(
      `USERSCRIPT_PICKUP, lead_id: ${data.lead_id}, trackcode: ${data.track_code}, intake_date: ${data.intake_date}, intake_time: ${start_time}:00-${start_time + 3}:00`,
    );
  }
}
