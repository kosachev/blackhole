import { Endpoint } from "../core/endpoint";

export class CancelPayment extends Endpoint {
  cancelPayment(body: CancelPaymentRequest): Promise<CancelPaymentResponse> {
    return this.client.post("/v2/Cancel", body);
  }
}

export type CancelPaymentRequest = {
  /**
   * @description Идентификатор терминала, выдается мерчанту в Т‑Бизнес.
   * @example TinkoffBankTest
   */
  TerminalKey: string;
  /**
   * @description Идентификатор платежа в системе Т‑Бизнес.
   * @example 2304882
   */
  PaymentId: string;
  /**
   * @description Подпись запроса — хэш `SHA-256`.
   * @example c0ad1dfc4e94ed44715c5ed0e84f8ec439695b9ac219a7a19555a075a3c3ed24
   */
  // Token: string; // not in client
  /**
   * @description IP-адрес клиента.
   * @example 192.168.255.255
   */
  IP?: string;
  /**
   * @description Сумма в копейках. Если не передан, используется `Amount`, переданный в методе **Init**.
   *
   *
   *     При отмене статуса `NEW` поле `Amount` игнорируется, даже если оно заполнено. Отмена производится на полную сумму.
   *
   * @example 19200
   */
  Amount?: number;
  /** @description JSON-объект с данными чека. Обязателен, если подключена онлайн-касса.
   *
   *     Если отмена делается только по части товаров, данные, переданные в этом запросе, могут отличаться данных, переданных в **Init**.
   *     При полной отмене структура чека не передается, при частичной — передаются товары, которые нужно отменить. */
  Receipt?: unknown;
  /** @description Обязательный для маркетплейсов. JSON-объект с данными маркетплейса. */
  Shops?: unknown[];
  /**
   * @description Код банка в классификации СБП, в который нужно выполнить возврат. Смотрите параметр `MemberId` методе [**QrMembersList**](#tag/Oplata-cherez-SBP/paths/~1QrMembersList/post).
   * @example 77892
   */
  QrMemberId?: string;
  /**
   * @description Способ платежа.
   *
   * @example BNPL
   * @enum {string}
   */
  Route?: "TCB" | "BNPL";
  /**
   * @description Источник платежа.
   *
   * @example BNPL
   * @enum {string}
   */
  Source?: "installment" | "BNPL";
  /** @description Идентификатор операции на стороне мерчанта. Параметр не работает для операций по СБП. Обязателен для операций «Долями» и в рассрочку.
   *
   *     * Если поле не передано или пустое (""), запрос будет обработан без проверки ранее созданных возвратов.
   *     * Если поле заполнено, перед проведением возврата проверяется запрос на отмену с таким `ExternalRequestId`.
   *     * Если такой запрос уже есть, в ответе вернется текущее состояние платежной операции, если нет — платеж отменится.
   *     * Для операций «Долями» при заполнении параметра нужно генерировать значение в формате `UUID v4`.
   *     * Для операций в рассрочку при заполнении параметра нужно генерировать значение с типом `string` — ограничение 100 символов.
   *      */
  ExternalRequestId?: string;
};

export type CancelPaymentResponse = {
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
   * @description Статус транзакции.
   * @example REVERSED
   */
  Status: string;
  /**
   * @description Сумма в копейках до операции отмены.
   * @example 13000
   */
  OriginalAmount: number;
  /**
   * @description Сумма в копейках после операции отмены.
   * @example 5000
   */
  NewAmount: number;
  /**
   * @description Уникальный идентификатор транзакции в системе Т‑Бизнес.
   * @example 2304882
   */
  PaymentId: number;
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
  /**
   * @description Идентификатор операции на стороне мерчанта.
   * @example 756478567845678436
   */
  ExternalRequestId?: string;
};
