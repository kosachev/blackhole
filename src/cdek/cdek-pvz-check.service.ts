import { Injectable } from "@nestjs/common";
import { CdekService } from "./cdek.service";
import { AmoService } from "../amo/amo.service";
import { AMO } from "../amo/amo.constants";
import { Cron } from "@nestjs/schedule";

@Injectable()
export class CdekPvzCheckService {
  constructor(
    private readonly cdek: CdekService,
    private readonly amo: AmoService,
  ) {}

  // executes in 10:05 everyday
  @Cron("0 0 10 * * * ")
  async refreshToken() {
    await this.cdek.client.refreshToken();
  }

  // executes in 10:05 everyday
  @Cron("0 5 10 * * *")
  async handler() {
    const leads = await this.getLeadsInCdekDelivery();
    if (leads.length === 0) return;

    let statuses: {
      lead_id: number;
      code: string;
      date: Date;
    }[] = [];

    for (const lead of leads) {
      statuses.push(await this.getLastStatus(lead.lead_id, lead.uuid));
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    statuses = statuses.filter((item) => {
      const duration = Date.now() - item.date.getTime();
      return (
        duration > 1000 * 3600 * 24 * 4 && // duration between 4 days
        duration < 1000 * 3600 * 24 * 5 && // and 5 days
        item.code === "ACCEPTED_AT_PICK_UP_POINT"
      );
    });
    if (statuses.length === 0) return;

    await this.amo.client.salesbot.runTask(
      statuses.map((item) => ({
        bot_id: AMO.SALESBOT.END_OF_KEEP_AT_PVZ,
        entity_type: 2,
        entity_id: item.lead_id,
      })),
    );
  }

  private async getLeadsInCdekDelivery(): Promise<{ lead_id: number; uuid: string }[]> {
    const leads = await this.amo.client.lead.getLeads({
      filter: (f) => f.statuses([[AMO.PIPELINE.MAIN, AMO.STATUS.SENT]]),
    });
    if (!leads || leads._embedded.leads.length === 0) return [];
    const active_leads = leads._embedded.leads
      .filter(
        (lead) =>
          lead.custom_fields_values.find(
            (item) => item.field_id === AMO.CUSTOM_FIELD.TRACK_NUMBER && item.values?.at(0)?.value,
          ) &&
          lead.custom_fields_values.find(
            (item) => item.field_id === AMO.CUSTOM_FIELD.CDEK_UUID && item.values?.at(0)?.value,
          ) &&
          lead.custom_fields_values.find(
            (item) =>
              item.field_id === AMO.CUSTOM_FIELD.DELIVERY_TYPE &&
              item.values?.at(0)?.value === "Экспресс по России",
          ),
      )
      .map((lead) => ({
        lead_id: lead.id,
        uuid: lead.custom_fields_values
          .find((item) => item.field_id === AMO.CUSTOM_FIELD.CDEK_UUID)
          ?.values?.at(0)?.value as string,
      }));

    return active_leads;
  }

  private async getLastStatus(
    lead_id: number,
    uuid: string,
  ): Promise<{ lead_id: number; code: string; date: Date }> {
    const res = await this.cdek.client.getOrderByUUID(uuid);
    return {
      lead_id,
      code: res.entity?.statuses[0]?.code, // last status will be first in array, because it datetime sorted
      date: new Date(res.entity?.statuses[0]?.date_time),
    };
  }
}
