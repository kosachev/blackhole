import { ForbiddenException, Injectable, Logger } from "@nestjs/common";

import { AmoService } from "../../amo/amo.service";
import { NotificationPayment } from "../lib/core/webhook";
import { AMO } from "src/amo/amo.constants";
import { RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";
import { TBankService } from "../tbank.service";

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
    // if (!data.Token || !this.tbankService.checkToken(data)) {
    //   this.logger.warn("NOTIFICATION_PYAMENT, webhooktoken invalid");
    //   throw new ForbiddenException("Unouthorized, token invalid");
    // }

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
        await this.proccessPaymentNotification(leadId, data, "✅", AMO.STATUS.PAYMENT);
        break;
      }
      case "CANCELED":
      case "REFUNDED":
      case "PARTIAL_REFUNDED":
      case "REVERSED":
      case "PARTIAL_REVERSED":
      case "REJECTED":
      case "AUTH_FAIL":
      case "DEADLINE_EXPIRED": {
        await this.proccessPaymentNotification(leadId, data, "⚠️");
        break;
      }
      default: {
        this.logger.warn(
          `NOTIFICATION_PAYMENT, unhandled status ${data.Status}, orderId: ${data.OrderId}, paymentId: ${data.PaymentId}`,
        );
      }
    }
  }

  private async proccessPaymentNotification(
    leadId: number,
    data: NotificationPayment,
    level: "✅" | "⚠️",
    statusId?: number,
  ): Promise<void> {
    const leadUpdateRequest: RequestUpdateLead = {
      custom_fields_values: [
        {
          field_id: AMO.CUSTOM_FIELD.BANK_STATUS,
          values: [{ value: data.Status ?? "NEVER" }],
        },
      ],
    };

    if (data.PaymentId) {
      leadUpdateRequest.custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.BANK_PAYMENTID,
        values: [{ value: data.PaymentId.toString() }],
      });
    }

    if (data.OrderId) {
      leadUpdateRequest.custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.BANK_ORDERID,
        values: [{ value: data.OrderId }],
      });
    }

    if (data.Pan) {
      leadUpdateRequest.custom_fields_values.push({
        field_id: AMO.CUSTOM_FIELD.BANK_PAN,
        values: [{ value: data.Pan }],
      });
    }

    if (statusId) {
      leadUpdateRequest.status_id = statusId;
    }

    await Promise.all([
      this.amo.client.lead.updateLeadById(leadId, leadUpdateRequest),
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: leadId,
          note_type: "common",
          params: {
            text: `${level} Банк: ${STATUS_DESCRIPTION[data.Status]} (${data.Status})
  PaymentId: ${data.PaymentId}
  OrderId: ${data.OrderId}${data.Pan ? `\nPan: ${data.Pan}` : ""}
  Сумма: ${data.Amount / 100} руб.`,
          },
        },
      ]),
    ]);
  }
}
