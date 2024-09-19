import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TelegramService } from "../telegram/telegram.service";
import {
  RequestAddCatalogElement,
  RequestUpdateCatalogElement,
} from "@shevernitskiy/amo/src/api/catalog/types";
import { CustomFieldsValue, Tag } from "@shevernitskiy/amo/src/typings/entities";

import { AmoService } from "./amo.service";
import { AMO } from "./amo.constants";

export type Good = {
  name: string;
  sku: string;
  price: number;
  quantity: number;
  weight?: number;
};

export type Order = {
  name: string;
  number?: number;
  delivery_type?: "PICKUP" | "COURIER_OUTSIDE_MKAD" | "COURIER" | "CDEK" | "POST";
  delivery_cost?: number;
  comment?: string;
  tag?: "SITE"[];
  location?: {
    city?: string;
    street?: string;
    house?: string;
    apartment?: string;
    zip?: string;
  };
  client: {
    name: string;
    phone: string;
    email?: string;
    tz?: string;
  };
  goods: Good[];
  ad?: {
    first_visit?: string;
    yclid?: string;
    client_id?: string;
    counter?: string;
    source_site?: string;
    device_type?: string;
    region?: string;
    utm?: string;
  };
};

const DELIVERY_TYPE_MAP = {
  PICKUP: "Самовывоз",
  COURIER_OUTSIDE_MKAD: "Курьером (Московская область)",
  COURIER: "Курьером (в пределах МКАД)",
  CDEK: "Экспресс по России",
  POST: "Почта России",
} as const;

const TAG_MAP = {
  SITE: AMO.TAG.SITE,
} as const;

const FIELD_MAP = {
  number: AMO.CUSTOM_FIELD.ORDER_ID,
  delivery_type: AMO.CUSTOM_FIELD.DELIVERY_TYPE,
  delivery_cost: AMO.CUSTOM_FIELD.DELIVERY_COST,
  comment: AMO.CUSTOM_FIELD.COMMENT_CLIENT,

  // location
  city: AMO.CUSTOM_FIELD.CITY,
  street: AMO.CUSTOM_FIELD.STREET,
  house: AMO.CUSTOM_FIELD.BUILDING,
  apartment: AMO.CUSTOM_FIELD.FLAT,
  zip: AMO.CUSTOM_FIELD.INDEX,

  // client
  phone: AMO.CONTACT.PHONE,
  email: AMO.CONTACT.EMAIL,
  tz: AMO.CONTACT.TZ,
  client_city: AMO.CONTACT.CITY,
  client_address: AMO.CONTACT.ADDRESS,

  // ad
  first_visit: AMO.CUSTOM_FIELD.FIRST_VISIT,
  yclid: AMO.CUSTOM_FIELD.YD_YCLID,
  client_id: AMO.CUSTOM_FIELD.YM_CLIENT_ID,
  counter: AMO.CUSTOM_FIELD.COUNTER,
  source_site: AMO.CUSTOM_FIELD.SOURCE_SITE,
  device_type: AMO.CUSTOM_FIELD.DEVICE_TYPE,
  region: AMO.CUSTOM_FIELD.REGION,
  utm: AMO.CUSTOM_FIELD.UTM,

  // goods
  sku: AMO.CATALOG.CUSTOM_FIELD.SKU,
  price: AMO.CATALOG.CUSTOM_FIELD.PRICE,
  quantity: AMO.CATALOG.CUSTOM_FIELD.QUANTITY,
  weight: AMO.CATALOG.CUSTOM_FIELD.WEIGHT,
} as const;

@Injectable()
export class LeadCreateService {
  protected readonly logger: Logger = new Logger(LeadCreateService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
    private readonly amo: AmoService,
  ) {}

  async goodEmplaceHandler(data: Good) {
    if (!data.sku || isNaN(data.price) || isNaN(data.quantity)) {
      this.logger.error("GOOD_EMPLACE, failed to create good, bad data");
      throw new BadRequestException("ERROR");
    }

    try {
      await this.addOrUpdateGoods([data]);
    } catch (err) {
      this.logger.error(`GOOD_EMPLACE, failed to create good`);
      throw new InternalServerErrorException(err);
    }
    this.logger.log(`GOOD_EMPLACE, sku: ${data.sku}, name: ${data.name}`);
  }

  async leadCreateHandler(data: Order) {
    this.logger.log(`LEAD_CREATE, name: ${data.name}`);

    const errors = this.validateRequieredFields(data);
    if (errors) {
      this.logger.error(`LEAD_CREATE, failed to create lead, validation errors: ${errors}`);
      throw new BadRequestException(errors);
    }

    const contact_id = await this.findContactByPhone(data.client.phone);
    const goods_with_id = await this.addOrUpdateGoods(data.goods);
    const price = data.goods.reduce((acc, good) => acc + good.price * good.quantity, 0);

    const lead = await this.amo.client.lead.addComplex([
      {
        name: data.name,
        price: price,
        tags_to_add: this.valuesToTags(data.tag),
        custom_fields_values: [
          ...this.deliveryTypeToCf(data.delivery_type),
          ...this.valuesToCf({
            number: data.number,
            delivery_cost: data.delivery_cost,
            comment: data.comment,
          }),
          ...this.valuesToCf(data.location),
          ...this.valuesToCf(data.ad),
        ],
        _embedded: {
          contacts: [
            contact_id
              ? { id: contact_id }
              : {
                  name: data.client.name,
                  custom_fields_values: this.valuesToCf({
                    phone: data.client.phone,
                    email: data.client.email,
                    tz: data.client.tz,
                    client_city: data.location?.city,
                    client_address:
                      [
                        data.location?.street,
                        data.location?.house,
                        data.location?.apartment,
                        data.location?.zip,
                      ]
                        .filter(Boolean)
                        .join(", ") ?? "",
                  }),
                },
          ],
        },
      },
    ]);

    if (!lead || lead.length < 1) {
      this.logger.error("LEAD_CREATE, failed to create lead");
      throw new InternalServerErrorException("Failed to create lead");
    }

    const link = await this.amo.client.link.addLinksByEntityId(
      lead[0].id,
      "leads",
      goods_with_id.map((good) => ({
        to_entity_id: good.id,
        to_entity_type: "catalog_elements",
        metadata: {
          catalog_id: AMO.CATALOG.GOODS,
          quantity: good.quantity,
        },
      })),
    );

    if (!link) {
      this.logger.error("LEAD_CREATE, failed to link goods to lead");
      throw new InternalServerErrorException("Failed to link goods to lead");
    }

    this.logger.log(`LEAD_CREATE, success, lead_id: ${lead[0].id}, price: ${price}`);
    const message = `💰 Новый заказ: <a href="https://${this.config.get<string>("AMO_DOMAIN")}/leads/detail/${lead[0].id}">${data.name}</a> (<b>${price}</b> руб.)\n\n${data.goods.map((item) => `${item.name} - ${item.quantity}шт`).join("\n")}`;
    Promise.all([this.telegram.textToAdmin(message), this.telegram.textToManager(message)]);
  }

  private async findContactByPhone(phone: string): Promise<number | undefined> {
    const res = await this.amo.client.contact.getContacts({
      query: phone,
    });
    if (res && res._embedded?.contacts?.length > 0) {
      return res._embedded?.contacts[0].id;
    }
  }

  private async addOrUpdateGoods(goods: Good[]): Promise<(Good & { id: number })[]> {
    const amo_goods = await Promise.all(
      goods.map((good) =>
        this.amo.client.catalog.getCatalogElementsByCatalogId(AMO.CATALOG.GOODS, {
          query: good.sku,
        }),
      ),
    );

    const add_goods: RequestAddCatalogElement[] = [];
    const update_goods: RequestUpdateCatalogElement[] = [];

    for (let i = 0; i < amo_goods.length; i++) {
      const amo_good = amo_goods[i];
      const good = goods[i];

      if (amo_good && amo_good._embedded?.elements?.length > 0) {
        update_goods.push({
          name: good.name,
          id: amo_good._embedded?.elements[0].id,
          custom_fields_values: this.valuesToCf({
            price: good.price.toString(),
            weight:
              good.weight?.toString() ??
              amo_good._embedded?.elements[0].custom_fields_values?.find(
                (item) => item.field_id === AMO.CATALOG.CUSTOM_FIELD.WEIGHT,
              )?.values[0].value,
          }),
        });
      } else {
        add_goods.push({
          name: good.name,
          custom_fields_values: this.valuesToCf({
            sku: good.sku,
            price: good.price.toString(),
            quantity: "0",
            weight: good.weight?.toString(),
          }),
        });
      }
    }

    const promises = [];
    if (add_goods.length > 0) {
      promises.push(this.amo.client.catalog.addCatalogElements(AMO.CATALOG.GOODS, add_goods));
    }
    if (update_goods.length > 0) {
      promises.push(this.amo.client.catalog.updateCatalogElements(AMO.CATALOG.GOODS, update_goods));
    }

    let res = await Promise.all(promises);

    if (res.includes(null)) {
      this.logger.error("LEAD_CREATE, failed to add or update some goods");
      res = res.filter((r) => r !== null);
    }

    const out: (Good & { id: number })[] = [];
    for (const method of res) {
      for (const el of method._embedded?.elements) {
        out.push({
          ...goods.find((good) => good.name === el.name)!,
          id: el.id,
        });
      }
    }

    return out;
  }

  private validateRequieredFields(data: Order): string | undefined {
    const errors: string[] = [];

    if (!data.name) {
      errors.push("name");
    }
    if (!data.client?.name) {
      errors.push("client.name");
    }
    if (!data.client?.phone) {
      errors.push("client.phone");
    }
    if (!data.goods || !Array.isArray(data.goods) || data.goods.length === 0) {
      errors.push("goods");
    } else {
      for (const good of data.goods) {
        if (!good.name) {
          errors.push("good.name");
        }
        if (!good.sku) {
          errors.push("good.sku");
        }
        if (!good.price) {
          errors.push("good.price");
        }
        if (!good.quantity) {
          errors.push("good.quantity");
        }
      }
    }

    return errors.length > 0 ? `missing requiered fields: ${errors.join(", ")}` : undefined;
  }

  private valuesToCf(values?: Record<string, any>): CustomFieldsValue[] {
    const out: CustomFieldsValue[] = [];
    if (!values) return out;

    for (const [key, value] of Object.entries(values)) {
      if (!Object.hasOwn(FIELD_MAP, key) || value === undefined) continue;
      out.push({
        field_id: FIELD_MAP[key],
        values: [{ value: value.toString() }],
      });
    }

    return out;
  }

  private valuesToTags(tags?: string[]): Partial<Tag>[] {
    const out: Partial<Tag>[] = [];

    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        if (!Object.hasOwn(TAG_MAP, tag)) continue;
        out.push({ id: TAG_MAP[tag] });
      }
    }

    return out;
  }

  private deliveryTypeToCf(delivery_type?: string): CustomFieldsValue[] {
    const out: CustomFieldsValue[] = [];

    if (delivery_type && Object.hasOwn(DELIVERY_TYPE_MAP, delivery_type)) {
      out.push({
        field_id: AMO.CUSTOM_FIELD.DELIVERY_TYPE,
        values: [{ value: DELIVERY_TYPE_MAP[delivery_type] }],
      });
    }

    return out;
  }

  private stripPhone(phone: string): string {
    return phone.replace(/\D/g, "");
  }
}
