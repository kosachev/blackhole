import { Injectable, Logger } from "@nestjs/common";
import { LeadCreateService, type Order } from "../amo/lead-create.service";
import { timestampToDateString } from "../utils/timestamp.function";

const DELIVERY_TYPE_MAP = {
  Самовывоз: "PICKUP",
  "Курьером (Московская область)": "COURIER_OUTSIDE_MKAD",
  "Курьером (в пределах МКАД)": "COURIER",
  "Экспресс по России (СДЕК)": "CDEK",
  "Почта России": "POST",
} as const;

export type TildaOrderData = {
  Name: string;
  Phone: string;
  Email: string;
  delivery: string;
  address_city_mkad?: string;
  address_street_mkad?: string;
  address_house_mkad?: string;
  address_flat_mkad?: string;
  address_index_mkad?: string;
  Textarea?: string;
  Checkbox: "yes" | string;
  ymclientid: string;
  payment: {
    sys: string;
    systranid: string;
    orderid: string;
    products: {
      name: string;
      quantity: number;
      amount: number;
      price: string;
      sku?: string;
      options: {
        option: string;
        variant: string;
      }[];
    }[];
    amount: string;
  };
  COOKIES?: string;
  formid: string;
  formname: string;
  firstvisit?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_group?: string;
  utm_content?: string;
  utm_term?: string;
  utm_campaign_name?: string;
  utm_yclid?: string;
  utm_refferer?: string;
  utm_refferertype?: string;
  utm_region?: string;
  utm_devicetype?: string;
  sigma: string;
};

@Injectable()
export class TildaService {
  private readonly logger = new Logger(TildaService.name);
  constructor(private readonly leadCreateService: LeadCreateService) {}

  async handler(data: TildaOrderData, headers: Headers): Promise<void> {
    this.logger.log(`TILDA_NEW_ORDER, id: ${data.payment.orderid}, amount: ${data.payment.amount}`);

    const order = this.tildaOrderDTO(data);
    if (headers["User-Agent"] || headers["user-agent"]) {
      order.ad.user_agent = headers["User-Agent"] || headers["user-agent"];
    }

    await this.leadCreateService.leadCreateHandler(order);
  }

  tildaOrderDTO(data: TildaOrderData): Order {
    const coockies = new Map<string, string>(
      data.COOKIES?.split(";")
        .map((c) => c.trim().split("=") as [string, string])
        .filter(([key]) => key) ?? [],
    );

    const order = {
      name: `Тильда ${data.payment.orderid}`,
      number: Number.isNaN(+data.payment.orderid) ? undefined : +data.payment.orderid,
      responsible_user: "MANAGER1",
      delivery_type:
        data.delivery in DELIVERY_TYPE_MAP
          ? DELIVERY_TYPE_MAP[data.delivery as keyof typeof DELIVERY_TYPE_MAP]
          : undefined,
      comment: data.Textarea,
      tag: ["TILDA"],
      location: undefined,
      client: {
        name: data.Name,
        phone: data.Phone?.length > 0 ? data.Phone.replace(/\D/g, "") : data.Phone,
        email: data.Email,
      },
      goods: data.payment.products.map((good) => {
        const size_option = good.options.find((o) => o.option === "Размер");
        const size = size_option?.variant ? ` размер: ${size_option.variant}` : "";
        return {
          name: `${good.name}${size}`,
          quantity: good.quantity,
          price: +good.price,
          sku: good.sku ?? `F${Math.random().toString().slice(2, 13)}`, // generate fake sku if not provided
        };
      }),
      ad: {
        // utm: coockies.get("TILDAUTM")
        //   ? decodeURIComponent(coockies.get("TILDAUTM")!).replaceAll("|||", "&")
        //   : undefined,
        ym_counter: undefined,
        ym_client_id: data.ymclientid,
        yclid: data.utm_yclid,
        first_visit:
          coockies.get("firstvisit") && Number.isFinite(+coockies.get("firstvisit"))
            ? timestampToDateString(+coockies.get("firstvisit")!)
            : undefined,
        utm_campaign_name: data.utm_campaign_name,
        utm_refferer: data.utm_refferer,
        utm_refferertype: data.utm_refferertype,
        device_type: data.utm_devicetype,
        utm_region: data.utm_region,
        utm_source: data.utm_source,
        utm_group: data.utm_group,
        utm_medium: data.utm_medium,
        utm_content: data.utm_content,
        utm_campaign: data.utm_campaign,
        utm_term: data.utm_term,
        user_agent: undefined,
      },
    } satisfies Order;

    if (
      data.address_city_mkad ||
      data.address_street_mkad ||
      data.address_house_mkad ||
      data.address_flat_mkad ||
      data.address_index_mkad
    ) {
      (order as Order).location = {
        city: data.address_city_mkad,
        street: data.address_street_mkad,
        house: data.address_house_mkad,
        apartment: data.address_flat_mkad,
        zip: data.address_index_mkad,
      };
    }

    return order;
  }
}
