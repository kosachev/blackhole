/**
 * @description **Уведомление о платеже**
 */
export type NotificationPayment = {
  /**
   * @description Идентификатор терминала. Выдается мерчанту в Т‑Бизнес
   *     при заведении терминала.
   *
   * @example TinkoffBankTest
   */
  TerminalKey?: string;
  /**
   * @description Сумма в копейках.
   *
   * @example 100000
   */
  Amount?: number;
  /**
   * @description Идентификатор заказа в системе мерчанта.
   *
   * @example 21050
   */
  OrderId?: string;
  /**
   * @description Успешность прохождения запроса — `true`/`false`.
   *
   * @example true
   */
  Success?: boolean;
  /**
   * @description Статус платежа.
   */
  Status?: PaymentStatus;
  /**
   * @description Уникальный идентификатор транзакции в системе Т‑Бизнес.
   *
   * @example 13660
   */
  PaymentId?: number;
  /**
   * @description Код ошибки. `0` в случае успеха.
   *
   * @example 0
   */
  ErrorCode?: string;
  /** @description Краткое описание ошибки.
   *      */
  Message?: string;
  /** @description Подробное описание ошибки.
   *      */
  Details?: string;
  /**
   * @description Идентификатор автоплатежа.
   * @example 3207469334
   */
  RebillId?: number;
  /**
   * @description Идентификатор карты в системе Т‑Бизнес.
   *
   * @example 10452089
   */
  CardId?: number;
  /** @description Замаскированный номер карты или телефона. */
  Pan?: string;
  /**
   * @description Срок действия карты
   *     в формате `MMYY`, где `YY` — две последние цифры года.
   *
   * @example 0229
   */
  ExpDate?: string;
  /**
   * @description Подпись запроса. Формируется по такому же принципу, как и в случае
   *     запросов в Т‑Бизнес.
   *
   * @example 7241ac8307f349afb7bb9dda760717721bbb45950b97c67289f23d8c69cc7b96
   */
  Token?: string;
  /** @description Дополнительные параметры платежа, переданные при создании заказа. Являются обязательными для платежей в рассрочку. В ответе параметр приходит в формате <code>Data</code> — не полностью в верхнем регистре. */
  DATA?: {
    /**
     * @description Способ платежа.
     *
     * @example TCB
     * @enum {string}
     */
    Route?: "TCB";
    /**
     * @description Источник платежа.
     *
     * @example Installment
     * @enum {string}
     */
    Source?: "Installment";
    /**
     * @description Сумма выданного кредита в копейках. Возвращается только для платежей в рассрочку, если в запросе [Confirm](https://www.tbank.ru/kassa/dev/payments/#tag/Dvuhstadijnyj-platezh/operation/Confirm) был передан параметр `Source` в значении `Installment`.
     *
     * @example 10000
     */
    CreditAmount?: number;
  };
};

export type PaymentStatus =
  /** MAPI получил запрос создать платёж, создал его и вернул PaymentId и PaymentURL. */
  | "NEW"
  /** Платёжная форма открыта в браузере покупателя. */
  | "FORM_SHOWED"
  /** Платёж обрабатывается MAPI и платёжной системой. */
  | "AUTHORIZING"
  /** Операция авторизована. Деньги заблокированы на карте покупателя. */
  | "AUTHORIZED"
  /** Подтверждение платежа обрабатывается MAPI и платёжной системой. */
  | "CONFIRMING"
  /** Операция подтверждена. Деньги списаны с карты покупателя. */
  | "CONFIRMED"
  /** Отмена авторизованного, но неподтверждённого платежа обрабатывается. */
  | "REVERSING"
  /** Частичная отмена по авторизованной операции. */
  | "PARTIAL_REVERSED"
  /** Полная отмена по авторизованной операции. */
  | "REVERSED"
  /** Отмена подтверждённого платежа обрабатывается. */
  | "REFUNDING"
  /** Частичный возврат по подтверждённой операции. */
  | "PARTIAL_REFUNDED"
  /** Полный возврат по подтверждённой операции. */
  | "REFUNDED"
  /** Платёж отменён мерчантом. */
  | "CANCELED"
  /** Автоматическое закрытие сессии по истечении срока 3DS/redirect-дедлайна. */
  | "DEADLINE_EXPIRED"
  /** Банк отклонил платёж. */
  | "REJECTED"
  /** Ошибка авторизации или провал 3DS. */
  | "AUTH_FAIL";
