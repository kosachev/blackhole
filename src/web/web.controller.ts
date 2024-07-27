import type { Response } from "express";
import { Readable } from "stream";
import { Body, Controller, Post, Get, Query, Res, UseFilters } from "@nestjs/common";
import { RequestPartialReturn, PartialReturnService } from "./partial-return.service";
import { CdekPickupService, RequestCdekPickup } from "./cdek-pickup.service";
import { PrintPdfService } from "./print-pdf.service";
import { DeliveryPriceService, RequestDeliveryPrice } from "./delivery-price.service";
import { GlobalExceptionFilter } from "../utils/global-exception.filter";

@Controller("web")
@UseFilters(GlobalExceptionFilter)
export class WebController {
  constructor(
    private readonly partial_return: PartialReturnService,
    private readonly cdek_pickup: CdekPickupService,
    private readonly print_pdf: PrintPdfService,
    private readonly delivery_price: DeliveryPriceService,
  ) {}

  @Post("partial_return")
  async partialReturn(@Body() data: RequestPartialReturn) {
    return this.partial_return.handler(data);
  }

  @Post("cdek_pickup")
  async cdekPickup(@Body() data: RequestCdekPickup) {
    return this.cdek_pickup.handler(data);
  }

  @Get("print_pdf")
  async printPdf(@Query("url") url: string, @Res() response: Response) {
    const stream = await this.print_pdf.handler(url);
    const readable = Readable.from(stream);
    response.set({ "Content-Type": "application/pdf" });
    readable.pipe(response);
  }

  @Post("delivery_price")
  async deliveryPrice(@Body() data: RequestDeliveryPrice) {
    return this.delivery_price.handler(data);
  }
}
