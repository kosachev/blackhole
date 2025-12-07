import { Injectable, Logger } from "@nestjs/common";
import { CdekService } from "./cdek.service";
import { AmoService } from "../amo/amo.service";
import { AMO } from "../amo/amo.constants";
import { Cron } from "@nestjs/schedule";
import { GoogleSheetsService } from "../google-sheets/google-sheets.service";
import type { GetCashOnDeliveryRegistry, GetOrder } from "cdek/src/types/api/response";
import type { RequestUpdateLead } from "@shevernitskiy/amo/src/api/lead/types";
import type { RequestAddNote } from "@shevernitskiy/amo/src/api/note/types";
import { stringDate } from "../utils/timestamp.function";
import { SpendingsEntry } from "../google-sheets/spendings.sheet";

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

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
  | { startDate: string; daysAmount: number; errors: string[] }
  | { startDate: string; daysAmount: number; registries: number }
  | ({ startDate: string; daysAmount: number; registries: number } & ProccessOrdersResult);

@Injectable()
export class CdekRegistryCheckService {
  private readonly BATCH_SIZE = 5;
  private readonly LOOKBACK_DAYS = 14;
  private readonly AMOUNT_DAYS = 14;
  private readonly PROCESS_REGISTRIES_FILE = "./data/registries.json";
  private readonly MAX_PROCESS_REGISTRIES_SIZE = 100;

  private readonly logger = new Logger(CdekRegistryCheckService.name);

  constructor(
    private readonly cdek: CdekService,
    private readonly amo: AmoService,
    private readonly googleSheets: GoogleSheetsService,
  ) {}

  // executes in 23:55 everyday
  @Cron("0 55 23 * * *")
  async handler(date?: string): Promise<CdekRegistryCheckResult> {
    let daysAmount = this.AMOUNT_DAYS;
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - this.LOOKBACK_DAYS);
    if (date) {
      startDate = new Date(date);
      daysAmount = 1;
    }

    const allRegistries = await this.batchGetRegistries(startDate, daysAmount);

    if (allRegistries.errors && allRegistries.errors.length > 0) {
      this.logger.error(`errors: ${allRegistries.errors.join(", ")}`);
      return { startDate: startDate.toISOString(), daysAmount, errors: allRegistries.errors };
    }

    const filteredRegistries = await this.filterProcessedRegistries(allRegistries.registries);

    if (!filteredRegistries.registries || filteredRegistries.registries.length === 0) {
      this.logger.log(
        `startDate: ${startDate.toISOString()}, daysAmount: ${daysAmount}, registries: 0`,
      );
      return { startDate: startDate.toISOString(), daysAmount, registries: 0 };
    }

    const orders = await this.batchGetOrder(filteredRegistries.registries);
    const result = await this.proccessOrders(orders.ordersMap);

    await this.writeProccessRegistriesFile(filteredRegistries.processedRegistries);

    this.logger.log(
      `startDate: ${startDate.toISOString()}, daysAmount: ${daysAmount}, registries: ${filteredRegistries.registries.length}, directOrders: ${result.directOrders}, returnOrders: ${result.returnOrders}, courierPickups: ${result.courierPickups}, googleSheetsSalesUpdates: ${result.googleSheetsSalesUpdates}, googleSheetsSpendingAddings: ${result.googleSheetsSpendingAddings}, amoUpdates: ${result.amoUpdates}, amoNotes: ${result.amoNotes}`,
    );
    return {
      startDate: startDate.toISOString(),
      daysAmount,
      registries: filteredRegistries.registries.length,
      ...result,
    };
  }

  async filterProcessedRegistries(registries: GetCashOnDeliveryRegistry["registries"]): Promise<{
    registries: GetCashOnDeliveryRegistry["registries"];
    processedRegistries: number[];
  }> {
    let processedRegistries = await this.readProccessRegistriesFile();

    registries = registries.filter(
      (registry) => !processedRegistries.includes(registry.registry_number),
    );

    const newRegistries = registries.map((registry) => registry.registry_number);
    processedRegistries = [...newRegistries, ...processedRegistries];

    return { registries, processedRegistries };
  }

  async batchGetRegistries(
    startDate: Date,
    days: number,
  ): Promise<{ registries: GetCashOnDeliveryRegistry["registries"]; errors: string[] }> {
    const registries: GetCashOnDeliveryRegistry["registries"] = [];
    const errors: string[] = [];

    const datesToProcess: Date[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      datesToProcess.push(date);
    }

    for (let i = 0; i < datesToProcess.length; i += this.BATCH_SIZE) {
      const chunk = datesToProcess.slice(i, i + this.BATCH_SIZE);

      const promises = chunk.map((date) => {
        return this.cdek.client.getCashOnDeliveryRegistry({
          date: date.toISOString().split("T")[0],
        });
      });

      const results = await Promise.allSettled(promises);

      results.forEach((res, index) => {
        const currentDate = chunk[index];

        if (res.status === "fulfilled") {
          const data = res.value;

          if (data.errors && data.errors.length > 0) {
            errors.push(...data.errors.map((err) => `${err.code}: ${err.message}`));
          }
          if (data.registries && data.registries.length > 0) {
            registries.push(...data.registries);
          }
        } else {
          errors.push(
            `Failed to fetch registries for date: ${currentDate.toISOString()} reason: ${res.reason}`,
          );
        }
      });

      if (i + this.BATCH_SIZE < datesToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return { registries, errors };
  }

  async batchGetOrder(
    registries: GetCashOnDeliveryRegistry["registries"],
  ): Promise<{ ordersMap: Map<string, CombinedOrderData>; failedOrders: FailedOrder[] }> {
    const ordersMap = new Map<string, CombinedOrderData>();
    const failedOrders: FailedOrder[] = [];

    const flatOrders = registries.flatMap((registry) =>
      registry.orders.map((order) => ({
        ...order,
        registry_number: registry.registry_number,
      })),
    );

    for (let i = 0; i < flatOrders.length; i += this.BATCH_SIZE) {
      const chunk = flatOrders.slice(i, i + this.BATCH_SIZE);
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

          const custom_fields_values: { field_id: number; values: { value: string }[] }[] = [
            {
              field_id: AMO.CUSTOM_FIELD.DELIVERY_COST,
              values: [{ value: `${data.total_sum_without_agent + data.agent_commission_sum}` }],
            },
          ];

          if (paymentTitle) {
            custom_fields_values.push({
              field_id: AMO.CUSTOM_FIELD.PAY_TYPE,
              values: [{ value: paymentTitle }],
            });
          }

          amoUpdates.push({
            id: +data.entity.number,
            custom_fields_values,
          });
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

  async readProccessRegistriesFile(): Promise<number[]> {
    if (!existsSync(this.PROCESS_REGISTRIES_FILE)) return [];
    const data = JSON.parse(await readFile(this.PROCESS_REGISTRIES_FILE, "utf8"));
    return data;
  }

  async writeProccessRegistriesFile(data: number[]): Promise<void> {
    if (data.length > this.MAX_PROCESS_REGISTRIES_SIZE) {
      data.length = this.MAX_PROCESS_REGISTRIES_SIZE;
    }
    await writeFile(this.PROCESS_REGISTRIES_FILE, JSON.stringify(data, null, 2), "utf8");
  }
}
