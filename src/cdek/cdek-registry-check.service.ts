import { Injectable, Logger } from "@nestjs/common";
import { CdekService } from "./cdek.service";
import { AmoService } from "../amo/amo.service";
import { AMO } from "../amo/amo.constants";
import { Cron } from "@nestjs/schedule";
import { GoogleSheetsService } from "../google-sheets/google-sheets.service";
import type { GetCashOnDeliveryRegistry, GetOrder } from "cdek/src/types/api/response";
import type { RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";
import type { RequestAddNote } from "@shevernitskiy/amo/src/api/note/types";
import { stringDate } from "src/utils/timestamp.function";
import { SpendingsEntry } from "src/google-sheets/spendings.sheet";

type FailedOrder = {
  cdek_number: string;
  registry_number: number;
};

type CombinedOrderData = GetCashOnDeliveryRegistry["registries"][number]["orders"][number] & {
  registry_number: number;
  entity: GetOrder["entity"];
};

type ProccessOrdersResult = {
  directOrders: number;
  returnOrders: number;
  courierPickups: number;
  googleSheetsSalesUpdates: number;
  googleSheetsSpendingAddings: number;
  amoUpdates: number;
  amoNotes: number;
};

export type CdekRegistryCheckResult =
  | { date: string; errors: string[] }
  | { date: string; registries: number }
  | ({ date: string; registries: number } & ProccessOrdersResult);

@Injectable()
export class CdekRegistryCheckService {
  private readonly logger = new Logger(CdekRegistryCheckService.name);

  constructor(
    private readonly cdek: CdekService,
    private readonly amo: AmoService,
    private readonly googleSheets: GoogleSheetsService,
  ) {}

  // executes in 23:55 everyday
  @Cron("0 55 23 * * *")
  async handler(date?: string): Promise<CdekRegistryCheckResult> {
    if (!date) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      date = d.toISOString().split("T")[0];
    }

    const data = await this.cdek.client.getCashOnDeliveryRegistry({ date });

    if (data.errors && data.errors.length > 0) {
      const errors = data.errors.map((err) => `${err.code}: ${err.message}`);
      this.logger.error(`date: ${date}, errors: ${errors.join(", ")}`);
      return { date, errors };
    }
    if (!data.registries || data.registries.length === 0) {
      this.logger.log(`date: ${date}, registries: 0`);
      return { date, registries: 0 };
    }

    const orders = await this.batchGetOrder(data);
    const result = await this.proccessOrders(orders.ordersMap);

    this.logger.log(
      `date: ${date}, registries: ${data.registries.length}, directOrders: ${result.directOrders}, returnOrders: ${result.returnOrders}, courierPickups: ${result.courierPickups}, googleSheetsSalesUpdates: ${result.googleSheetsSalesUpdates}, googleSheetsSpendingAddings: ${result.googleSheetsSpendingAddings}, amoUpdates: ${result.amoUpdates}, amoNotes: ${result.amoNotes}`,
    );
    return { date, registries: data.registries.length, ...result };
  }

  async batchGetOrder(
    data: GetCashOnDeliveryRegistry,
  ): Promise<{ ordersMap: Map<string, CombinedOrderData>; failedOrders: FailedOrder[] }> {
    const BATCH_SIZE = 5;
    const ordersMap = new Map<string, CombinedOrderData>();
    const failedOrders: FailedOrder[] = [];

    const flatOrders = data.registries.flatMap((registry) =>
      registry.orders.map((order) => ({
        ...order,
        registry_number: registry.registry_number,
      })),
    );

    for (let i = 0; i < flatOrders.length; i += BATCH_SIZE) {
      const chunk = flatOrders.slice(i, i + BATCH_SIZE);
      const promises = chunk.map((order) =>
        this.cdek.client.getOrderByCdekNumber(+order.cdek_number),
      );
      const results = await Promise.allSettled(promises);

      results.forEach((res, index) => {
        const currentOrder = chunk[index];

        if (res.status === "fulfilled") {
          const apiData = res.value;

          const combined: CombinedOrderData = {
            ...currentOrder,
            entity: apiData.entity,
          };

          ordersMap.set(currentOrder.cdek_number, combined);
        } else {
          failedOrders.push({
            cdek_number: currentOrder.cdek_number,
            registry_number: currentOrder.registry_number,
          });
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return {
      ordersMap,
      failedOrders,
    };
  }

  async proccessOrders(ordersMap: Map<string, CombinedOrderData>): Promise<ProccessOrdersResult> {
    const courierPickups: SpendingsEntry[] = [];
    const amoUpdates: RequestUpdateLead[] = [];
    const amoNotes: RequestAddNote[] = [];
    let updatedEntries = 0;
    let directOrders = 0;
    let returnOrders = 0;

    for (const [cdek_number, data] of ordersMap) {
      // Courier pickup from office
      if (
        data.entity.recipient.name.toLowerCase().includes("сдек") ||
        data.entity.recipient.company.toLowerCase().includes("сдек") ||
        data.entity.recipient.name.toLowerCase().includes("сдэк") ||
        data.entity.recipient.company.toLowerCase().includes("сдэк")
      ) {
        const date = data.entity.statuses.at(-1)?.date_time
          ? new Date(data.entity.statuses.at(-1)?.date_time)
          : new Date();
        courierPickups.push({
          date: stringDate(date),
          description: `Забор товара СДЭК ${data.cdek_number} (реестр ${data.registry_number})`,
          amount: data.total_sum_without_agent,
        });
        continue;
      }

      // Return order
      if (
        data.entity.sender.company.toLowerCase().includes("сдек") ||
        data.entity.sender.company.toLowerCase().includes("сдэк")
      ) {
        returnOrders++;

        const res = await this.googleSheets.sales.updateEntry(
          { returnCdekNumber: [cdek_number] },
          {
            ownerReturnDeliveryPrice: data.total_sum_without_agent,
            returnClosedByRegister: data.registry_number.toString(),
          },
          false,
        );

        updatedEntries += res.updatedEntries;
        continue;
      } else {
        directOrders++;

        const paymentType = data.entity?.delivery_detail?.payment_info?.at(0)?.type;
        const paymentTitle =
          paymentType === "CARD"
            ? "Оплата картой"
            : paymentType === "CASH"
              ? "Наличные"
              : undefined;

        const res = await this.googleSheets.sales.updateEntry(
          { cdekNumber: [cdek_number] },
          {
            ownerDeliveryPrice: data.total_sum_without_agent + data.agent_commission_sum,
            closedByRegister: data.registry_number.toString(),
            paymentType: paymentTitle,
          },
          false,
        );

        if (data.entity.number) {
          amoNotes.push({
            entity_id: +data.entity.number,
            note_type: "common",
            params: {
              text: `✅ СДЭК: Заказ закрыт реестром ${data.registry_number}`,
            },
          });

          if (paymentTitle) {
            amoUpdates.push({
              id: +data.entity.number,
              custom_fields_values: [
                {
                  field_id: AMO.CUSTOM_FIELD.PAY_TYPE,
                  values: [{ value: paymentTitle }],
                },
              ],
            });
          }
        }

        updatedEntries += res.updatedEntries;
      }
    }

    if (updatedEntries > 0) {
      await this.googleSheets.sales
        .save()
        .catch((e) => this.logger.error(`PROCCESS_ORDERS_GS_ERROR: ${e.message}`, e.stack));
    }

    if (courierPickups.length > 0) {
      await this.googleSheets.spendings
        .addSpendings(courierPickups)
        .catch((e) => this.logger.error(`PROCCESS_ORDERS_GS_ERROR: ${e.message}`, e.stack));
    }

    if (amoUpdates.length > 0) {
      await this.amo.client.lead.updateLeads(amoUpdates);
    }

    if (amoNotes.length > 0) {
      await this.amo.client.note.addNotes("leads", amoNotes);
    }

    return {
      directOrders,
      returnOrders,
      courierPickups: courierPickups.length,
      googleSheetsSalesUpdates: updatedEntries,
      googleSheetsSpendingAddings: courierPickups.length,
      amoUpdates: amoUpdates.length,
      amoNotes: amoNotes.length,
    };
  }
}
