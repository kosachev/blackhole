import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
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
      await this.tbankService.cancelPayment(data.paymentId);

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
