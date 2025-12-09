import type { Response } from "express";
import { Readable } from "stream";
import { Body, Controller, Post, Get, Query, Res, UseFilters } from "@nestjs/common";
import { type RequestPartialReturn, PartialReturnService } from "./partial-return.service";
import { CdekPickupService, type RequestCdekPickup } from "./cdek-pickup.service";
import { PrintPdfService } from "./print-pdf.service";
import { DeliveryPriceService, type RequestDeliveryPrice } from "./delivery-price.service";
import { GlobalExceptionFilter } from "../utils/global-exception.filter";
import { PVZPickerService, type RequestPVZPicker } from "./pvz-picker.service";
import {
  PermitService,
  type RequestPermitAuto,
  type RequestPermitCustomer,
} from "./permit.service";
import { AddressSanitizerService, type RequestAddressSanitizer } from "./address-sanitizer.service";
import { CloneLeadService, type RequestCloneLead } from "./clone-lead.service";
import {
  FirstLeadInteractionService,
  type RequestFirstTimeInteraction,
} from "./first-lead-interaction.service";
import { PaymentCancelService, type RequestPaymentCancel } from "./payment-cancel.service";

@Controller("web")
@UseFilters(GlobalExceptionFilter)
export class WebController {
  constructor(
    private readonly partial_return: PartialReturnService,
    private readonly cdek_pickup: CdekPickupService,
    private readonly print_pdf: PrintPdfService,
    private readonly delivery_price: DeliveryPriceService,
    private readonly pvz_picker: PVZPickerService,
    private readonly permit_service: PermitService,
    private readonly address_sanitizer: AddressSanitizerService,
    private readonly clone_lead: CloneLeadService,
    private readonly first_lead_interaction: FirstLeadInteractionService,
    private readonly payment_cancel: PaymentCancelService,
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

  @Get("pvz_picker")
  async getPVZList(@Query("index") index: string) {
    return this.pvz_picker.getPVZList(+index);
  }

  @Post("pvz_picker")
  async pickPVZ(@Body() data: RequestPVZPicker) {
    return this.pvz_picker.handler(data);
  }

  @Post("permit")
  async permit(@Body() data: RequestPermitCustomer) {
    return this.permit_service.handlerPermitCustomer(data);
  }

  @Post("permit_auto")
  async permitAuto(@Body() data: RequestPermitAuto) {
    return this.permit_service.handlerPermitAuto(data);
  }

  @Post("address_sanitizer")
  async addressSanitizer(@Body() data: RequestAddressSanitizer) {
    return this.address_sanitizer.handler(data);
  }

  @Post("clone_lead")
  async cloneLead(@Body() data: RequestCloneLead) {
    return this.clone_lead.handler(data);
  }

  @Post("first_lead_interaction")
  async firstLeadInteraction(@Body() data: RequestFirstTimeInteraction) {
    return this.first_lead_interaction.handler(data);
  }

  @Post("payment_cancel")
  async paymentCancel(@Body() data: RequestPaymentCancel) {
    return this.payment_cancel.handler(data);
  }
}
