import { Injectable, Logger } from "@nestjs/common";
import { TBankService } from "./tbank.service";
import { AmoService } from "../amo/amo.service";
import { AMO } from "../amo/amo.constants";
import type { GetStateResponse } from "./lib/api/payment-status";
import type { RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";
import { timestamp } from "../utils/timestamp.function";
import { Cron } from "@nestjs/schedule";

const STATUS_DESCRIPTION = {
  CONFIRMED: "Платеж оплачен",
  CANCELED: "Платеж отменён",
  REFUNDED: "Полный возврат платежа",
  PARTIAL_REFUNDED: "Частичный возврат платежа",
  REVERSED: "Полный возврат по авторизованному платежу",
  PARTIAL_REVERSED: "Частичный возврат по авторизованному платежу",
  REJECTED: "Платеж отклонён",
  AUTH_FAIL: "Платеж завершился ошибкой",
  DEADLINE_EXPIRED: "Платеж не был оплачен вовремя",
};

@Injectable()
export class TBankReceiptStatusCheckService {
  private readonly logger = new Logger(TBankReceiptStatusCheckService.name);

  constructor(
    private readonly amo: AmoService,
    private readonly client: TBankService,
  ) {}

  // executes in 9:30 everyday
  @Cron("0 30 9 * * *")
  async handler(): Promise<void> {
    try {
      const leads = await this.getLeadsInRequisiteNewStatus();
      if (leads.length === 0) {
        this.logger.log(`leads: ${leads.length}`);
        return;
      }

      const paymentStatuses = await this.getPaymentStatuses(leads);
      const statuses = await this.getPaymentStatuses(paymentStatuses);
      const filteredStatuses = statuses.filter(
        (item) => item.payment.Status === "DEADLINE_EXPIRED",
      );
      if (filteredStatuses.length === 0) {
        this.logger.log(
          `leads: ${leads.length}, deadline expired payments: ${filteredStatuses.length}`,
        );
        return;
      }

      await this.proccessPayments(filteredStatuses);

      this.logger.log(
        `leads: ${leads.length}, deadline expired payments: ${filteredStatuses.length}`,
      );
    } catch (error) {
      this.logger.error(`Error in handler: ${error.message}`, error.stack);
    }
  }

  async getLeadsInRequisiteNewStatus(): Promise<{ leadId: number; paymentId: string }[]> {
    const res = await this.amo.client.lead.getLeads({
      filter: (f) => f.statuses([[AMO.PIPELINE.MAIN, AMO.STATUS.REQUISITE]]),
    });
    if (!res || res._embedded.leads.length === 0) return [];

    const leads = res._embedded.leads
      .filter(
        (lead) =>
          lead.custom_fields_values.find(
            (item) =>
              item.field_id === AMO.CUSTOM_FIELD.BANK_STATUS && item.values?.at(0)?.value === "NEW",
          ) &&
          lead.custom_fields_values.find(
            (item) =>
              item.field_id === AMO.CUSTOM_FIELD.BANK_PAYMENTID && item.values?.at(0)?.value,
          ),
      )
      .map((lead) => ({
        leadId: lead.id,
        paymentId: lead.custom_fields_values
          .find((item) => item.field_id === AMO.CUSTOM_FIELD.BANK_PAYMENTID)
          ?.values?.at(0)?.value as string,
      }));

    return leads;
  }

  async getPaymentStatuses(
    leads: { leadId: number; paymentId: string }[],
  ): Promise<{ leadId: number; paymentId: string; payment: GetStateResponse }[]> {
    const promises = leads.map((lead) => this.client.getPaymentStatus(lead.paymentId));
    const statuses = await Promise.all(promises);

    return leads.map((lead, index) => ({
      leadId: lead.leadId,
      paymentId: lead.paymentId,
      payment: statuses[index],
    }));
  }

  async proccessPayments(
    leads: { leadId: number; paymentId: string; payment: GetStateResponse }[],
  ): Promise<void> {
    const updates: RequestUpdateLead[] = [];
    const tasks: any[] = [];
    const notes: any[] = [];

    for (const lead of leads) {
      updates.push({
        id: lead.leadId,
        custom_fields_values: [
          {
            field_id: AMO.CUSTOM_FIELD.BANK_STATUS,
            values: [{ value: lead.payment.Status }],
          },
        ],
      });

      tasks.push({
        entity_id: lead.leadId,
        entity_type: "leads",
        complete_till: timestamp("today_ending"),
        task_type_id: AMO.TASK.CALL,
        responsible_user_id: AMO.USER.MANAGER1,
        text: "Оплата просрочена. Связаться с клиентом. Перевыставить счет",
      });

      notes.push({
        entity_id: lead.leadId,
        note_type: "common",
        params: {
          text: `⚠️ Банк: ${STATUS_DESCRIPTION[lead.payment.Status]} (${lead.payment.Status})
  PaymentId: ${lead.paymentId}
  OrderId: ${lead.payment.OrderId}
  Сумма: ${lead.payment.Amount / 100} руб.`,
        },
      });
    }

    await Promise.all([
      this.amo.client.lead.updateLeads(updates),
      this.amo.client.task.addTasks(tasks),
      this.amo.client.note.addNotes("leads", notes),
    ]);
  }
}
