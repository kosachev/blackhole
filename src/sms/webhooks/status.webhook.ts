import { Injectable, Logger } from "@nestjs/common";

import { AmoService } from "../../amo/amo.service";
import { DbService } from "../../db/db.service";
import { GoogleSheetsService } from "../../google-sheets/google-sheets.service";
import { humanizeDuration, stringDate } from "../../utils/timestamp.function";
import { SmsService } from "../sms.service";

export type RedSmsWebhookData = {
  uuid?: string;
  status?: string;
  status_time?: string | number;
  errCode?: string | number;
  to?: string;
  from?: string;
  text?: string;
  operator?: string;
  pool_operator_name?: string;
  price?: string | number;
};

@Injectable()
export class StatusWebhook {
  protected readonly logger: Logger = new Logger(StatusWebhook.name);

  constructor(
    private readonly amo: AmoService,
    private readonly sms: SmsService,
    private readonly db: DbService,
    private readonly googleSheets: GoogleSheetsService,
  ) {}

  async handle(data: RedSmsWebhookData): Promise<void> {
    const uuid = data?.uuid;
    const status = data?.status;

    if (!uuid || !status) {
      this.logger.warn("REDSMS_WEBHOOK, no uuid or status in payload");
      return;
    }

    const sms = this.sms.getSmsToLead(uuid);
    if (!sms) {
      this.logger.warn(`REDSMS_WEBHOOK, unknown uuid: ${uuid}, to: ${data.to}`);
      return;
    }

    if (this.sms.isPendingStatus(status)) {
      this.logger.log(`REDSMS_WEBHOOK, lead_id: ${sms.leadId}, uuid: ${uuid}, status: ${status}`);
      return;
    }

    const status_time = +data.status_time || Math.round(Date.now() / 1000);
    const duration = humanizeDuration(status_time * 1000 - sms.ts);
    const errCode = +data.errCode || 0;
    const operator = (data.operator || data.pool_operator_name || "").replaceAll('"', "").trim();
    const operatorText = operator ? ` оператором ${operator}` : "";

    const text =
      status === "delivered"
        ? `✅ SMS: доставлено${operatorText} (${duration})`
        : `❌ SMS: ${this.sms.describeStatus(status)} (${status})${errCode ? `, код ${errCode}` : ""}${operatorText} (${duration})`;

    try {
      await this.amo.client.note.addNotes("leads", [
        {
          entity_id: sms.leadId,
          note_type: "common",
          params: { text },
        },
      ]);

      this.sms.deleteSmsToLead(uuid);

      this.logger.log(
        `REDSMS_WEBHOOK, lead_id: ${sms.leadId}, uuid: ${uuid}, status: ${status}, note: ${text}`,
      );
    } catch (error) {
      this.logger.error(
        `REDSMS_WEBHOOK_ERROR, lead_id: ${sms.leadId}, uuid: ${uuid}, status: ${status}, error: ${error.message}`,
        error.stack,
      );
    }

    await this.addSpending(operator, +data.price || 0, new Date(status_time * 1000));
  }

  private async addSpending(operator: string, amount: number, date: Date): Promise<void> {
    const description = `СМС ${operator}`.trim();

    try {
      this.db.spendings.addSpendings([
        { date: Math.floor(date.getTime() / 1000), description, amount },
      ]);
    } catch (error) {
      this.logger.error(
        `REDSMS_SPENDINGS_DB_ERROR, description: ${description}, error: ${error.message}`,
        error.stack,
      );
    }

    await this.googleSheets.spendings
      .addSpendings([{ date: stringDate(date), description, amount }])
      .catch((error) =>
        this.logger.error(
          `REDSMS_SPENDINGS_GS_ERROR, description: ${description}, error: ${error.message}`,
          error.stack,
        ),
      );
  }
}
