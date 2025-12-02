import { ForbiddenException, Injectable, Logger } from "@nestjs/common";

import { AmoService } from "../../amo/amo.service";
import { NotificationPayment } from "../lib/core/webhook";
import { AMO } from "src/amo/amo.constants";
import { RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";
import { TBankService } from "../tbank.service";
import { timestamp } from "../../utils/timestamp.function";

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

type NotificationPaymentParams = {
  leadId: number;
  data: NotificationPayment;
  level: "✅" | "⚠️";
  statusId?: number;
  task?: string;
  tag?: number;
};

@Injectable()
export class NotificationPaymentWebhook {
  private readonly logger = new Logger(TBankService.name);

  constructor(
    private readonly amo: AmoService,
    private readonly tbankService: TBankService,
  ) {}

  async handler(data: NotificationPayment): Promise<void> {
    this.logger.log(
      `NOTIFICATION_PAYMENT, status: ${data.Status}, orderId: ${data.OrderId}, paymentId: ${data.PaymentId} `,
    );
    if (!data.Token || !this.tbankService.checkToken(data)) {
      this.logger.warn("NOTIFICATION_PYAMENT, webhooktoken invalid");
      throw new ForbiddenException("Unouthorized, token invalid");
    }

    const leadId = +data.OrderId?.split("-")[0];

    if (!leadId || isNaN(leadId) || leadId < 100000 || leadId > 9999999999) {
      this.logger.error(
        `NOTIFICATION_PAYMENT, bad leadId: ${leadId}, orderId: ${data.OrderId}, paymentId: ${data.PaymentId}`,
      );
      return;
    }

    switch (data.Status) {
      case "AUTHORIZED": {
        break;
      }
      case "CONFIRMED": {
        await this.proccessPaymentNotification({
          leadId,
          data,
          level: "✅",
          statusId: AMO.STATUS.PAYMENT,
          tag: AMO.TAG.DELIVERY_PAID,
        });
        break;
      }
      case "CANCELED":
      case "REFUNDED":
      case "PARTIAL_REFUNDED":
      case "REVERSED":
      case "PARTIAL_REVERSED": {
        await this.proccessPaymentNotification({ leadId, data, level: "⚠️" });
        break;
      }
      case "REJECTED":
      case "AUTH_FAIL": {
        await this.proccessPaymentNotification({
          leadId,
          data,
          level: "⚠️",
          task: "Проблемы с оплатой. Связаться с клиентом. Перевыставить счет",
        });
        break;
      }
      case "DEADLINE_EXPIRED": {
        await this.proccessPaymentNotification({
          leadId,
          data,
          level: "⚠️",
          task: "Оплата просрочена. Связаться с клиентом. Перевыставить счет",
        });
        break;
      }
      default: {
        this.logger.warn(
          `NOTIFICATION_PAYMENT, unhandled status ${data.Status}, orderId: ${data.OrderId}, paymentId: ${data.PaymentId}`,
        );
      }
    }
  }

  private async proccessPaymentNotification(params: NotificationPaymentParams): Promise<void> {
    const leadUpdateRequest: RequestUpdateLead = {
      custom_fields_values: [
        {
          field_id: AMO.CUSTOM_FIELD.BANK_STATUS,
          values: [{ value: params.data.Status ?? "NEVER" }],
        },
      ],
    };

    if (params.data.PaymentId) {
      leadUpdateRequest.custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.BANK_PAYMENTID,
        values: [{ value: params.data.PaymentId.toString() }],
      });
    }

    if (params.data.OrderId) {
      leadUpdateRequest.custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.BANK_ORDERID,
        values: [{ value: params.data.OrderId }],
      });
    }

    if (params.data.Pan) {
      leadUpdateRequest.custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.BANK_PAN,
        values: [{ value: params.data.Pan }],
      });
    }

    if (params.statusId) {
      leadUpdateRequest.status_id = params.statusId;
    }

    if (params.tag) {
      leadUpdateRequest.tags_to_add = [{ id: params.tag }];
    }

    const promises: Promise<unknown>[] = [
      this.amo.client.lead.updateLeadById(params.leadId, leadUpdateRequest),
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: params.leadId,
          note_type: "common",
          params: {
            text: `${params.level} Банк: ${STATUS_DESCRIPTION[params.data.Status]} (${params.data.Status})
  PaymentId: ${params.data.PaymentId}
  OrderId: ${params.data.OrderId}${params.data.Pan ? `\nPan: ${params.data.Pan}` : ""}
  Сумма: ${params.data.Amount / 100} руб.`,
          },
        },
      ]),
    ];

    if (params.task)
      promises.push(
        this.amo.client.task.addTasks([
          {
            entity_id: params.leadId,
            entity_type: "leads",
            complete_till: timestamp("today_ending"),
            task_type_id: AMO.TASK.PROCESS,
            responsible_user_id: AMO.USER.MANAGER1,
            text: params.task,
          },
        ]),
      );

    await Promise.all(promises);
  }
}
