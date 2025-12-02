import { CancelPayment } from "./api/cancel-payment";
import { MakePayment } from "./api/make-payment";
import { PaymentStatus } from "./api/payment-status";
import { Client, type ClientOptions } from "./core/client";

export class TBank {
  readonly client: Client;
  /**
   * @description Методы для проведения платежа.
   * @see {@link https://developer.tbank.ru/eacq/api/provedenie-platezha}
   */
  readonly makePayment: MakePayment;
  /**
   * @description Методы для проверки статуса платежа и заказа.
   * @see {@link https://developer.tbank.ru/eacq/api/status-platezha-ili-zakaza}
   */
  readonly paymentStatus: PaymentStatus;
  /**
   * @description Методы для отмены платежа.
   * @see {@link https://developer.tbank.ru/eacq/api/otmena-platezha}
   */
  readonly cancelPayment: CancelPayment;

  constructor(options: ClientOptions) {
    this.client = new Client(options);

    this.makePayment = new MakePayment(this.client);
    this.paymentStatus = new PaymentStatus(this.client);
    this.cancelPayment = new CancelPayment(this.client);
  }
}
