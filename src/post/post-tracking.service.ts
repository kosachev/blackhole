import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AmoService } from "../amo/amo.service";
import { AMO } from "../amo/amo.constants";
import { PostTracking, TrackingHistory } from "@shevernitskiy/post-tracking";
import { Cron } from "@nestjs/schedule";

type ParsedHistories = {
  notes: { lead_id: number; text: string }[];
  delivered: number[];
};

@Injectable()
export class PostTrackingService {
  private readonly logger = new Logger(PostTrackingService.name);
  private client: PostTracking;

  constructor(
    private readonly config: ConfigService,
    private readonly amo: AmoService,
  ) {
    this.client = new PostTracking(
      this.config.get<string>("POST_TRACKING_LOGIN"),
      this.config.get<string>("POST_TRACKING_PASSWORD"),
      { language: "RUS" },
      (error) => this.logger.error(error.message, error.stack),
    );
  }

  // executes in 19:05 everyday
  @Cron("0 5 19 * * *")
  async handler(): Promise<void> {
    const leads = await this.getLeadsInPostDelivery();
    const histories = await Promise.all(leads.map((lead) => this.client.tracking(lead.trackcode)));
    const leads_with_history = leads.map((lead, index) => ({ ...lead, history: histories[index] }));
    const to_update = this.parseHistories(leads_with_history);

    const promises: Promise<unknown>[] = [];

    if (to_update.notes.length > 0) {
      promises.push(
        this.amo.client.note.addNotes(
          "leads",
          to_update.notes.map((note) => ({
            entity_id: note.lead_id,
            note_type: "common",
            params: { text: note.text },
          })),
        ),
      );
    }

    if (to_update.delivered.length > 0) {
      promises.push(
        this.amo.client.lead.updateLeads(
          to_update.delivered.map((lead_id) => ({
            id: lead_id,
            status_id: AMO.STATUS.SUCCESS,
          })),
        ),
      );
    }

    await Promise.all(promises);

    this.logger.log(
      `Result: ${to_update.notes.length} notes, ${to_update.delivered.length} delivered`,
    );
  }

  // fetch leads with status AMO.STATUS.SENT, delivery type "Почта России" and existing trackcode
  private async getLeadsInPostDelivery(): Promise<{ lead_id: number; trackcode: number }[]> {
    const leads = await this.amo.client.lead.getLeads({
      filter: (f) => f.statuses([[AMO.PIPELINE.MAIN, AMO.STATUS.SENT]]),
    });
    if (!leads || leads._embedded.leads.length === 0) return [];
    // filter leads with type Pochta Rossii and trackcode != undefined
    const active_leads = leads._embedded.leads
      .filter(
        (lead) =>
          lead.custom_fields_values.find(
            (item) => item.field_id === AMO.CUSTOM_FIELD.TRACK_NUMBER && item.values?.at(0)?.value,
          ) &&
          lead.custom_fields_values.find(
            (item) =>
              item.field_id === AMO.CUSTOM_FIELD.DELIVERY_TYPE &&
              item.values?.at(0)?.value === "Почта России",
          ),
      )
      .map((lead) => ({
        lead_id: lead.id,
        trackcode: +lead.custom_fields_values
          .find((item) => item.field_id === AMO.CUSTOM_FIELD.TRACK_NUMBER)
          .values?.at(0)?.value,
      }));

    return active_leads;
  }

  // iterate over histories, form notes for entries for last 1 day, get id's of delivered leads
  private parseHistories(
    leads_with_history: {
      history: TrackingHistory;
      lead_id: number;
      trackcode: number;
    }[],
  ): ParsedHistories {
    const out: ParsedHistories = {
      notes: [],
      delivered: [],
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const { history, lead_id, trackcode } of leads_with_history) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const { index, place, operation_type, operation_desc, datetime } of history.history) {
        const diff = (Date.now() - datetime.getTime()) / 1000;
        // новые операции за последние сутки
        if (diff < 60 * 60 * 24) {
          out.notes.push({
            lead_id,
            text: `ℹ Почта: ${operation_type}, ${operation_desc} в ${place}, ${datetime.toLocaleString("ru-RU")}`,
          });
        }
      }
      if (history.last_operation === "Вручение") {
        out.notes.push({
          lead_id,
          text: `✔ Почта: заказ доставлен почтой и переведен в реализованные автоматически`,
        });
        out.delivered.push(lead_id);
      }
    }

    return out;
  }
}
