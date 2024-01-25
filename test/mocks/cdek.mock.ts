import { UpdateOrderStatus } from "cdek/src/types/api/webhook";

import { Cdek } from "cdek";

export class CdekServiceMock {
  client(): Cdek {
    return null as Cdek;
  }
}

export const order_status_static: UpdateOrderStatus = {
  type: "ORDER_STATUS",
  date_time: "2020-09-07T16:24:56+0700",
  uuid: "72753031-01e2-434f-b5a8-a4dbb3278101",
  attributes: {
    is_return: false,
    cdek_number: "1197739374",
    number: "31045357",
    status_code: "5",
    status_reason_code: "20",
    status_date_time: "2020-09-07T16:24:56+0700",
    city_name: "Набережные Челны",
  },
} as UpdateOrderStatus;

export function order_status_factory(
  status_code: number,
  status_reason_code?: number,
): UpdateOrderStatus {
  return {
    type: "ORDER_STATUS",
    date_time: "2020-09-07T16:24:56+0700",
    uuid: "72753031-01e2-434f-b5a8-a4dbb3278101",
    attributes: {
      is_return: false,
      cdek_number: "1197739374",
      number: "31045357",
      status_code: `${status_code}`,
      status_reason_code: status_reason_code ? `${status_reason_code}` : undefined,
      status_date_time: "2020-09-07T16:24:56+0700",
      city_name: "Набережные Челны",
    },
  } as UpdateOrderStatus;
}
