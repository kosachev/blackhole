import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { AMO } from "../amo/amo.constants";
import { AmoService } from "../amo/amo.service";
import { humanizeDuration, timestampToDateTimeString } from "../utils/timestamp.function";
import { UtmService } from "src/analytics/utm.service";

export type RequestFirstTimeInteraction = {
  leadId: number;
  userName: string;
  userId: number;
  dateCreate: number;
  channel: string;
  source?: string;
  ym_client_id?: string;
};

const FIELD_MAP = {
  utm: AMO.CUSTOM_FIELD.AD_UTM,
  utm_yclid: AMO.CUSTOM_FIELD.AD_YD_YCLID,
  utm_campaign_name: AMO.CUSTOM_FIELD.AD_UTM_CAMPAIGN_NAME,
  utm_refferer: AMO.CUSTOM_FIELD.AD_UTM_REFFERER,
  utm_refferertype: AMO.CUSTOM_FIELD.AD_UTM_REFFERER_TYPE,
  utm_device_type: AMO.CUSTOM_FIELD.AD_DEVICE_TYPE,
  utm_region: AMO.CUSTOM_FIELD.AD_UTM_REGION,
  utm_source: AMO.CUSTOM_FIELD.AD_UTM_SOURCE,
  utm_group: AMO.CUSTOM_FIELD.AD_UTM_GROUP,
  utm_medium: AMO.CUSTOM_FIELD.AD_UTM_MEDIUM,
  utm_content: AMO.CUSTOM_FIELD.AD_UTM_CONTENT,
  utm_campaign: AMO.CUSTOM_FIELD.AD_UTM_CAMPAIGN,
  utm_term: AMO.CUSTOM_FIELD.AD_UTM_TERM,
} as const;

@Injectable()
export class FirstLeadInteractionService {
  protected readonly logger: Logger = new Logger(FirstLeadInteractionService.name);

  constructor(
    private readonly amo: AmoService,
    private readonly utmService: UtmService,
  ) {}

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

    const tags_to_add = this.generateTags(data);
    const custom_fields_values = this.generateCustomFields(data);
    let text = `⏳ Первое взаимодействие: пользователь ${data.userName}, время ${now}, реакция ${tti}`;
    if (data.ym_client_id) text += `\nYM_CLIENT_ID: ${data.ym_client_id}`;
    if (data.source) text += `\nИсточник: ${data.source}`;

    await Promise.all([
      this.amo.client.lead.updateLeadById(data.leadId, { tags_to_add, custom_fields_values }),
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.leadId,
          note_type: "common",
          params: { text },
        },
      ]),
    ]);

    this.logger.log(
      `USERSCRIPT_FLI, lead_id: ${data.leadId}, user_name: ${data.userName}, tti: ${tti}, date_create: ${timestampToDateTimeString(data.dateCreate)}`,
    );
  }

  private generateTags(data: RequestFirstTimeInteraction): { id: number }[] {
    const tags = [];
    if (data.channel === "whatsapp") tags.push(AMO.TAG.WHATSAPP);
    if (data.source === "gerdacollection") tags.push(AMO.TAG.TILDA);
    if (data.source === "Gerda") tags.push(AMO.TAG.SITE);

    return tags.map((item) => ({ id: item }));
  }

  private generateCustomFields(data: RequestFirstTimeInteraction) {
    const now = timestampToDateTimeString(Date.now());

    const customFields: { field_id: number; values: { value: string }[] }[] = [
      {
        field_id: AMO.CUSTOM_FIELD.FIRST_TIME_INTERACTION,
        values: [{ value: now }],
      },
    ];

    if (data.ym_client_id) {
      customFields.push({
        field_id: AMO.CUSTOM_FIELD.AD_YM_CLIENT_ID,
        values: [{ value: data.ym_client_id }],
      });

      const utm = this.utmService.get(data.ym_client_id);

      if (utm) {
        for (const item of utm.split("&")) {
          const [key, value] = item.split("=");
          if (key in FIELD_MAP) {
            customFields.push({
              field_id: FIELD_MAP[key],
              values: [{ value: decodeURIComponent(value) }],
            });
          }
        }
      }
    }

    return customFields;
  }
}
