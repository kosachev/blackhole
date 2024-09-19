import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Task } from "@shevernitskiy/amo";

import { AmoService } from "./amo.service";
import { AMO } from "./amo.constants";
import { timestamp } from "../utils/timestamp.function";

@Injectable()
export class VisitReminderService {
  protected readonly logger: Logger = new Logger(VisitReminderService.name);

  constructor(private readonly amo: AmoService) {}

  // executes in 9:00 everyday
  @Cron("0 0 9 * * *")
  async handler() {
    const leads = await this.amo.client.lead.getLeads({
      filter: (f) => f.statuses([[AMO.PIPELINE.MAIN, AMO.STATUS.VISIT]]),
    });
    if (!leads) return;

    const tasks: Partial<Task>[] = [];

    for (const lead of leads._embedded.leads) {
      const visit_ts = lead.custom_fields_values?.find(
        (item) => item.field_id === AMO.CUSTOM_FIELD.DATE,
      )?.values[0].value;

      if (!visit_ts || isNaN(Number(visit_ts))) continue;

      const diff_in_days = (Number(visit_ts) - Date.now() / 1000) / 86400;
      if (diff_in_days >= 0 && diff_in_days <= 1) {
        tasks.push({
          entity_id: lead.id,
          entity_type: "leads",
          complete_till: timestamp("today_ending"),
          task_type_id: AMO.TASK.CALL,
          responsible_user_id: AMO.USER.ADMIN,
          text: "Подтвердить визит",
        });
      }
    }

    if (tasks.length > 0) {
      await this.amo.client.task.addTasks(tasks);
    }

    this.logger.log(`leads: ${leads._embedded.leads.length}, tasks: ${tasks.length}`);
  }
}
