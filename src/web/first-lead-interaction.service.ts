import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { AMO } from "../amo/amo.constants";
import { AmoService } from "../amo/amo.service";
import { humanizeDuration, timestampToDateTimeString } from "../utils/timestamp.function";

export type RequestFirstTimeInteraction = {
  leadId: number;
  userName: string;
  userId: number;
  dateCreate: number;
};

@Injectable()
export class FirstLeadInteractionService {
  protected readonly logger: Logger = new Logger(FirstLeadInteractionService.name);

  constructor(private readonly amo: AmoService) {}

  async handler(data: RequestFirstTimeInteraction) {
    if (
      !Number.isFinite(data.dateCreate) ||
      !Number.isFinite(data.leadId) ||
      data.dateCreate >= Date.now()
    ) {
      throw new BadRequestException("Invalid data");
    }

    const now = timestampToDateTimeString(Date.now());
    const tti = humanizeDuration(Date.now() - data.dateCreate);

    await Promise.all([
      this.amo.client.lead.updateLeadById(data.leadId, {
        custom_fields_values: [
          {
            field_id: AMO.CUSTOM_FIELD.FIRST_TIME_INTERACTION,
            values: [{ value: now }],
          },
        ],
      }),
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.leadId,
          note_type: "common",
          params: {
            text: `⏳ Первое взаимодействие: пользователь ${data.userName}, время ${now}, реакция ${tti}`,
          },
        },
      ]),
    ]);

    this.logger.log(
      `USERSCRIPT_FTI, lead_id: ${data.leadId}, user_name: ${data.userName}, tti: ${tti}, date_create: ${timestampToDateTimeString(data.dateCreate)}`,
    );
  }
}
