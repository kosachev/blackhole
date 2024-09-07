import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { AmoService } from "../amo/amo.service";
import { AMO } from "../amo/amo.constants";

import { PostTracking, type TrackingHistory } from "@shevernitskiy/post-tracking";
import type { RequestAddNote } from "@shevernitskiy/amo/src/api/note/types";

type ParsedHistories = {
  notes: RequestAddNote[];
  delivered: number[];
  returned: number[];
  return_delivered: number[];
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
      promises.push(this.amo.client.note.addNotes("leads", to_update.notes));
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

    if (to_update.returned.length > 0) {
      promises.push(
        this.amo.client.lead.updateLeads(
          to_update.delivered.map((lead_id) => ({
            id: lead_id,
            status_id: AMO.STATUS.RETURN,
            tags_to_add: [{ id: AMO.TAG.RETURN }],
            loss_reason_id: AMO.LOSS_REASON.REFUSED,
          })),
        ),
      );
    }

    if (to_update.return_delivered.length > 0) {
      promises.push(
        this.amo.client.lead.updateLeads(
          to_update.delivered.map((lead_id) => ({
            id: lead_id,
            status_id: AMO.STATUS.CLOSED,
            pipeline_id: AMO.PIPELINE.RETURN,
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
  private async getLeadsInPostDelivery(): Promise<
    { lead_id: number; trackcode: number; status_id: number }[]
  > {
    const leads = await this.amo.client.lead.getLeads({
      filter: (f) =>
        f.statuses([
          [AMO.PIPELINE.MAIN, AMO.STATUS.SENT],
          [AMO.PIPELINE.RETURN, AMO.STATUS.RETURN],
        ]),
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
        status_id: lead.status_id,
      }));

    return active_leads;
  }

  // iterate over histories, form notes for entries for last 1 day, get id's of delivered leads
  private parseHistories(
    leads_with_history: {
      history: TrackingHistory;
      lead_id: number;
      trackcode: number;
      status_id: number;
    }[],
  ): ParsedHistories {
    const out: ParsedHistories = {
      notes: [],
      delivered: [],
      returned: [],
      return_delivered: [],
    };

    for (const { history, lead_id, trackcode: _, status_id } of leads_with_history) {
      for (const { index: _, place, operation_type, operation_desc, datetime } of history.history) {
        const diff = (Date.now() - datetime.getTime()) / 1000;
        const is_return = status_id === AMO.STATUS.RETURN;

        // get operations only for last 1 day
        if (diff > 3600 * 24) continue;

        // common statuses
        if (operation_type !== "Вручение" && operation_type !== "Возврат") {
          out.notes.push({
            entity_id: lead_id,
            note_type: "extended_service_message",
            params: {
              text: `${operation_type}, ${operation_desc} в ${place}, ${datetime.toLocaleString("ru-RU")}`,
              service: is_return ? "ℹ Почта ВОЗВРАТ" : "ℹ Почта",
            },
          });
          if (operation_desc === "Прибыло в место вручения") {
            out.notes.push({
              entity_id: lead_id,
              note_type: "common",
              params: {
                text: is_return
                  ? `ℹ Почта ВОЗВРАТ: прибыло в место вручения`
                  : `ℹ Почта: прибыло в место вручения и ожидает получения адресатом`,
              },
            });
          }
        }

        if (operation_type === "Вручение") {
          out.notes.push({
            entity_id: lead_id,
            note_type: "common",
            params: {
              text: is_return
                ? `✔ Почта ВОЗВРАТ: возврат получен`
                : `✔ Почта: заказ доставлен почтой и переведен в реализованные автоматически`,
            },
          });

          if (is_return) {
            out.return_delivered.push(lead_id);
          } else {
            out.delivered.push(lead_id);
          }
        }

        if (operation_type === "Возврат" && !is_return) {
          out.notes.push({
            entity_id: lead_id,
            note_type: "common",
            params: {
              text: `⇌ Почта ВОЗВРАТ: Сделка переведена в возвраты по причине: ${operation_desc}`,
            },
          });
          out.returned.push(lead_id);
        }
      }
    }

    return out;
  }
}
