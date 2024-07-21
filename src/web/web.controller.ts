import type { Response } from "express";
import { Body, Controller, Post, Get, Query, Res } from "@nestjs/common";
import { RequestPartialReturn, PartialReturnService } from "./partial-return.service";
import { CdekPickupService, RequestCdekPickup } from "./cdek-pickup.service";
import { PrintPdfService } from "./print-pdf.service";
import { Readable } from "stream";

@Controller("web")
export class WebController {
  constructor(
    private readonly partial_return: PartialReturnService,
    private readonly cdek_pickup: CdekPickupService,
    private readonly print_pdf: PrintPdfService,
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
}
