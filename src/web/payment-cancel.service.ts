import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { AMO } from "../amo/amo.constants";
import { AmoService } from "../amo/amo.service";
import { TBankService } from "../tbank/tbank.service";

export type RequestPaymentCancel = {
  leadId: number;
  paymentId: string;
  paymentStatus: string;
};

@Injectable()
export class PaymentCancelService {
  protected readonly logger: Logger = new Logger(PaymentCancelService.name);

  constructor(
    private readonly amo: AmoService,
    private readonly tbankService: TBankService,
  ) {}

  async handler(data: RequestPaymentCancel) {
    if (data.paymentStatus !== "NEW" || !data.paymentId || data.paymentId.length < 1) {
      throw new BadRequestException("Invalid data");
    }

    try {
      const res = await this.tbankService.cancelPayment(data.paymentId);

      await Promise.all([
        this.amo.client.lead.updateLeadById(data.leadId, {
          custom_fields_values: [
            { field_id: AMO.CUSTOM_FIELD.BANK_STATUS, values: [{ value: res.Status }] },
          ],
        }),
        this.amo.client.note.addNotes("leads", [
          {
            entity_id: data.leadId,
            note_type: "common",
            params: {
              text: `⚠️ Банк: Платеж отменён (${res.Status})`,
            },
          },
        ]),
      ]);

      this.logger.log(
        `USERSCRIPT_PAYMENT_CANCEL, leadId: ${data.leadId}, paymentId: ${data.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `USERSCRIPT_PAYMENT_CANCEL_ERROR, leadId: ${data.leadId}, paymentId: ${data.paymentId}, error: ${error.message}`,
        error.stack,
      );

      await this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.leadId,
          note_type: "common",
          params: {
            text: `❌ Банк: Не удалось отменить платеж\n${error.message}`,
          },
        },
      ]);

      throw new InternalServerErrorException(error.message);
    }
  }
}
