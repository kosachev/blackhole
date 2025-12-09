import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TBank } from "./lib/tbank";
import type { InitPaymentResponse } from "./lib/api/make-payment";
import type { CancelPaymentResponse } from "./lib/api/cancel-payment";

@Injectable()
export class TBankService {
  private client: TBank;
  private terminalKey: string;

  constructor(private readonly config: ConfigService) {
    this.client = new TBank({
      baseUrl: "https://securepay.tinkoff.ru",
      terminalPassword: this.config.get<string>("TBANK_TERMINAL_PASSWORD"),
    });

    this.terminalKey = this.config.get<string>("TBANK_TERMINAL_KEY");
  }

  checkToken(data: Record<string, any>): boolean {
    return this.client.client.checkToken(data);
  }

  initPayment(data: {
    orderId: string;
    amount: number;
    description: string;
  }): Promise<InitPaymentResponse> {
    const date = new Date(Date.now() + 2.7e8); // дата через 3 дня

    return this.client.makePayment.initPayment({
      TerminalKey: this.terminalKey,
      OrderId: data.orderId,
      Amount: data.amount * 100,
      Description: data.description,
      RedirectDueDate: `${date.toISOString().slice(0, 19)}+03:00`,
    });
  }

  cancelPayment(paymentId: string): Promise<CancelPaymentResponse> {
    return this.client.cancelPayment.cancelPayment({
      TerminalKey: this.terminalKey,
      PaymentId: paymentId,
    });
  }
}
