import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TBank } from "./lib/tbank";
import type { InitPaymentResponse } from "./lib/api/make-payment";

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
    return this.client.makePayment.initPayment({
      TerminalKey: this.terminalKey,
      OrderId: data.orderId,
      Amount: data.amount * 100,
      Description: data.description,
    });
  }
}
