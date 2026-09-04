import { BadRequestException, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AMO } from "../amo/amo.constants";
import { AmoService } from "../amo/amo.service";
import { CdekService } from "../cdek/cdek.service";

import { postCalculator } from "@shevernitskiy/post-calculator";
import { GoogleSheetsService } from "../google-sheets/google-sheets.service";
import { Cron } from "@nestjs/schedule";

export type RequestDeliveryPrice = {
  lead_id: number;
  price: number;
  goods: {
    id: number;
    name: string;
    quantity: number;
    price: number;
    weight: number;
    sku: string;
  }[];
  index: string;
  delivery_type: string;
  delivery_tariff: string;
};

enum CdekTariff {
  OFFICE_TO_OFFICE = 136,
  OFFICE_TO_DOOR = 137,
  DOOR_TO_OFFICE = 138,
  DOOR_TO_DOOR = 139,
  ECONOMY_DOOR_TO_DOOR = 231,
  ECONOMY_DOOR_TO_OFFICE = 232,
  ECONOMY_OFFICE_TO_DOOR = 233,
  ECONOMY_OFFICE_TO_OFFICE = 234,
}

@Injectable()
export class DeliveryPriceService implements OnModuleInit {
  protected readonly logger: Logger = new Logger(DeliveryPriceService.name);

  private cdekDymanicPriceAddition?: number;

  constructor(
    private readonly config: ConfigService,
    private readonly amo: AmoService,
    private readonly cdek: CdekService,
    private readonly googleSheets: GoogleSheetsService,
  ) {}

  async handler(data: RequestDeliveryPrice) {
    switch (data.delivery_type) {
      case "Экспресс по России":
        await this.cdekDelivery(data);
        break;
      case "Почта России":
        await this.postDelivery(data);
        break;
      default:
        throw new BadRequestException("Unknown delivery type");
    }
  }

  async onModuleInit(): Promise<void> {
    await this.fetchCdekPriceAdditionFromGS();
  }

  getCdekPriceAddition(): number {
    const dynamic = this.cdekDymanicPriceAddition;
    const max = this.config.get<number>("CDEK_MAX_PRICE_ADDITION");

    return Math.min(dynamic ?? max ?? 0, max ?? Infinity);
  }

  // every day at 7:25 AM
  @Cron("0 25 7 * * *")
  async fetchCdekPriceAdditionFromGS(): Promise<void> {
    try {
      const sheetCdekPrice = await this.googleSheets.cdekPrice.getCdekDelta();

      if (
        (sheetCdekPrice !== undefined && Number.isFinite(sheetCdekPrice)) ||
        this.cdekDymanicPriceAddition === undefined
      ) {
        this.cdekDymanicPriceAddition = sheetCdekPrice * -1;
      }

      this.logger.log(
        `DELIVERY_PRICE, CDEK price addition fetched ${sheetCdekPrice}, current ${this.cdekDymanicPriceAddition}`,
      );
    } catch (error) {
      this.logger.error(`DELIVERY_PRICE, failed to fetch CDEK price addition`, error);
    }
  }

  async cdekDelivery(data: RequestDeliveryPrice) {
    const total_price = data.goods.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
    const total_weight = data.goods.reduce(
      (acc, curr) =>
        acc + curr.quantity * (curr.weight ?? this.config.get<number>("CDEK_DEFAULT_WEIGHT")),
      0,
    );
    const insurance =
      Math.round(total_price * this.config.get<number>("CDEK_INSURANCE") * 100) / 100; // 0.75% rounded to 2 decimals

    const [length, width, height] = this.config
      .get<string>("CDEK_DEFAULT_PARCEL_SIZE")
      .split("x")
      .map(Number);

    const tariff = this.parseTariff(data.delivery_tariff);
    const cdekPriceAddition = this.getCdekPriceAddition();

    const res = await this.cdek.client.calculatorByAvaibleTariffs({
      from_location: {
        postal_code: this.config.get<string>("OWNER_POST_INDEX"),
      },
      to_location: {
        postal_code: data.index,
      },
      services: [
        { code: "TRYING_ON" },
        { code: "PART_DELIV" },
        { code: "INSURANCE", parameter: total_price.toString() },
      ],
      packages: [
        {
          weight: total_weight,
          width,
          height,
          length,
        },
      ],
    });

    if (res === null) {
      await this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: {
            text: `❌ СДЕК: не удалось рассчитать стоимость доставки, ошибка сдек api`,
          },
        },
      ]);
      throw new BadRequestException("CDEK: delivery price failed");
    }

    const promises: unknown[] = [];
    const picked_tariff = res.tariff_codes?.find((item) => item.tariff_code === tariff);
    let message = "";

    if (tariff && picked_tariff) {
      const total = this.ceilToTens(picked_tariff.delivery_sum + insurance + cdekPriceAddition);

      promises.push(
        this.amo.client.lead.updateLeadById(data.lead_id, {
          custom_fields_values: [
            {
              field_id: AMO.CUSTOM_FIELD.CDEK_PREIOD,
              values: [{ value: `${picked_tariff.period_min}-${picked_tariff.period_max}` }],
            },
            {
              field_id: AMO.CUSTOM_FIELD.DELIVERY_COST,
              values: [{ value: total.toString() }],
            },
            {
              field_id: AMO.CUSTOM_FIELD.PREPAY,
              values: [{ value: total.toString() }],
            },
          ],
        }),
      );

      message = `стоимость доставки ${total}₽ для тарифа "${data.delivery_tariff}"`;
    } else {
      promises.push(
        this.amo.client.lead.updateLeadById(data.lead_id, {
          custom_fields_values: [
            {
              field_id: AMO.CUSTOM_FIELD.DELIVERY_TARIFF,
              values: [{ value: null }],
            },
          ],
        }),
      );

      message =
        data.delivery_tariff && data.delivery_tariff !== "Выбрать" && !tariff
          ? `тариф "${data.delivery_tariff}" не найден, доступные тарифы\n`
          : "доступные тарифы\n";
      message += res.tariff_codes
        .filter((item) => Object.values(CdekTariff).includes(item.tariff_code))
        .sort((a, b) => a.delivery_sum - b.delivery_sum)
        .map(
          (item) =>
            `${item.tariff_name} - ${this.ceilToTens(item.delivery_sum + insurance + cdekPriceAddition)}₽, ${item.period_min}-${item.period_max}д`,
        )
        .join("\n");
    }
    promises.push(
      this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: { text: `₽ СДЕК: ${message}` },
        },
      ]),
    );

    await Promise.all(promises);
  }

  parseTariff(tariff: string): number | undefined {
    switch (tariff) {
      case "Дверь - Дверь":
        return CdekTariff.DOOR_TO_DOOR;
      case "Дверь - Склад":
        return CdekTariff.DOOR_TO_OFFICE;
      case "Склад - Дверь":
        return CdekTariff.OFFICE_TO_DOOR;
      case "Склад - Склад":
        return CdekTariff.OFFICE_TO_OFFICE;
      case "Дверь - Дверь эконом":
        return CdekTariff.ECONOMY_DOOR_TO_DOOR;
      case "Дверь - Склад эконом":
        return CdekTariff.ECONOMY_DOOR_TO_OFFICE;
      case "Склад - Дверь эконом":
        return CdekTariff.ECONOMY_OFFICE_TO_DOOR;
      case "Склад - Склад эконом":
        return CdekTariff.ECONOMY_OFFICE_TO_OFFICE;
    }
    return undefined;
  }

  ceilToTens(value: number): number {
    return Math.ceil(value / 10) * 10;
  }

  async postDelivery(data: RequestDeliveryPrice) {
    const total_price = data.goods.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
    const total_weight = data.goods.reduce(
      (acc, curr) =>
        acc + curr.quantity * (curr.weight ?? this.config.get<number>("POST_DEFAULT_WEIGHT")),
      0,
    );

    try {
      const res = await postCalculator({
        object: this.config.get<number>("POST_DEFAULT_TARIFF"), // Посылка с объявленной ценностью и наложенным платежом
        from: this.config.get<number>("OWNER_POST_INDEX"),
        to: +data.index,
        weight: total_weight,
        sumoc: total_price * 100, // Сумма с копейками
        size: this.config.get<string>("POST_DEFAULT_PARCEL_SIZE"), // Размер посылки
      });

      await Promise.all([
        this.amo.client.lead.updateLeadById(data.lead_id, {
          custom_fields_values: [
            {
              field_id: AMO.CUSTOM_FIELD.CDEK_PREIOD,
              values: [{ value: `${res.delivery.min}-${res.delivery.max}` }],
            },
            {
              field_id: AMO.CUSTOM_FIELD.DELIVERY_COST,
              values: [{ value: `${res.paymoneynds / 100}` }],
            },
          ],
        }),
        this.amo.client.note.addNotes("leads", [
          {
            entity_id: data.lead_id,
            note_type: "common",
            params: {
              text: `₽ Почта: страховка ${res.cover.valnds / 100}₽, платный вес ${Math.round(res.weightpay / 10) / 100}кг\n${res.name} - ${res.paymoneynds / 100}₽ (тариф ${res.ground.valnds / 100}₽)`,
            },
          },
        ]),
      ]);
    } catch (err) {
      await this.amo.client.note.addNotes("leads", [
        {
          entity_id: data.lead_id,
          note_type: "common",
          params: {
            text: `✖ Почта: не удалось рассчитать стоимость доставки, ошибка почта api`,
          },
        },
      ]);
      throw new BadRequestException(`POST DELIVERY: delivery price failed, ${err.message}`);
    }
  }
}
