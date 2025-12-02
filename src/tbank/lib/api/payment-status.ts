import { Endpoint } from "../core/endpoint";

export class PaymentStatus extends Endpoint {
  paymentStatus(body: GetStateRequest): Promise<GetStateResponse> {
    return this.client.post("/v2/GetState", body);
  }

  checkOrder(body: CheckOrderRequest): Promise<CheckOrderResponse> {
    return this.client.post("/v2/CheckOrder", body);
  }
}

export type GetStateRequest = {
  /**
   * @description Идентификатор терминала. <br>
   *     Выдается мерчанту в Т‑Бизнес при заведении терминала.
   *
   * @example TinkoffBankTest
   */
  TerminalKey: string;
  /**
   * @description Идентификатор платежа в системе Т‑Бизнес.
   *
   * @example 13660
   */
  PaymentId: string;
  /**
   * @description Подпись запроса.
   *
   * @example 7241ac8307f349afb7bb9dda760717721bbb45950b97c67289f23d8c69cc7b96
   */
  // Token: string; // not in client
  /**
   * @description IP-адрес клиента.
   *
   * @example 192.168.0.52
   */
  IP?: string;
};
export type GetStateResponse = {
  /** @description Идентификатор терминала. Выдается мерчанту в Т‑Бизнес
   *     при заведении терминала.
   *      */
  TerminalKey: string;
  /** @description Сумма в копейках.
   *      */
  Amount: number;
  /** @description Идентификатор заказа в системе мерчанта.
   *      */
  OrderId: string;
  /** @description Успешность прохождения запроса — `true`/`false`.
   *      */
  Success: boolean;
  /** @description Статус платежа. Подробнее — в разделе [Статусная модель платежа](#tag/Scenarii-oplaty-po-karte/Statusnaya-model-platezha).
   *      */
  Status: string;
  /** @description Идентификатор платежа в системе Т‑Бизнес.
   *      */
  PaymentId: string;
  /** @description Код ошибки. `0` в случае успеха.
   *      */
  ErrorCode: string;
  /** @description Краткое описание ошибки.
   *      */
  Message?: string;
  /** @description Подробное описание ошибки.
   *      */
  Details?: string;
  /** @description Информация по способу оплаты или деталям для платежей в рассрочку.
   *      */
  Params?: {
    Key?: "Route" | "Source" | "CreditAmount";
    Value?:
      | "ACQ"
      | "BNPL"
      | "TCB"
      | "SBER"
      | "BNPL"
      | "cards"
      | "Installment"
      | "MirPay"
      | "qrsbp"
      | "SberPay"
      | "TinkoffPay"
      | "YandexPay";
  }[];
};

export type CheckOrderRequest = {
  /**
   * @description Идентификатор терминала, выдается мерчанту в Т‑Бизнес.
   * @example TinkoffBankTest
   */
  TerminalKey: string;
  /**
   * @description Номер заказа в системе мерчанта.
   *
   *     Не является уникальным идентификатором.
   *
   * @example 21057
   */
  OrderId: string;
  /**
   * @description Подпись запроса
   * @example 4c4c36adf9936b011879fa26f60759e7b47e57f7968283129b0ae9ac457486ab
   */
  // Token: string; // not in client
};

export type CheckOrderResponse = {
  /**
   * @description Идентификатор терминала, выдается мерчанту в Т‑Бизнес.
   * @example TinkoffBankTest
   */
  TerminalKey: string;
  /**
   * @description Идентификатор заказа в системе мерчанта.
   * @example 21057
   */
  OrderId: string;
  /**
   * @description Успешность прохождения запроса — `true`/`false`.
   * @example true
   */
  Success: boolean;
  /**
   * @description Код ошибки. `0` в случае успеха.
   * @example 0
   */
  ErrorCode: string;
  /**
   * @description Краткое описание ошибки.
   * @example OK
   */
  Message?: string;
  /**
   * @description Подробное описание ошибки.
   * @example None
   */
  Details?: string;
  Payments: {
    /**
     * @description Уникальный идентификатор транзакции в системе Т‑Бизнес.
     *
     * @example 124671934
     */
    PaymentId: string;
    /**
     * @description Сумма операции в копейках.
     *
     * @example 13660
     */
    Amount?: number;
    /**
     * @description Статус операции.
     *
     * @example NEW
     */
    Status: string;
    /**
     * @description RRN операции.
     *
     * @example 12345678
     */
    RRN?: string;
    /**
     * @description Успешность прохождения запроса — `true`/`false`.
     *
     * @example true
     */
    Success: string;
    /**
     * @description Код ошибки.
     *
     * @example 0
     */
    ErrorCode?: number;
    /**
     * @description Краткое описание ошибки.
     *
     * @example None
     */
    Message?: string;
    /**
     * @description Идентификатор платежа в СБП.
     *
     * @example A42631655397753A0000030011340501
     */
    SbpPaymentId?: string;
    /**
     * @description Хэшированный номер телефона покупателя.
     *
     * @example c4494ca1c0888b3fb0e2bfd0b83576aaae0d2c71161c5f472133ea9401473aee
     */
    SbpCustomerId?: string;
  }[];
};
