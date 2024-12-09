import { Module } from "@nestjs/common";
import { WebController } from "./web.controller";
import { PartialReturnService } from "./partial-return.service";
import { CdekPickupService } from "./cdek-pickup.service";
import { PrintPdfService } from "./print-pdf.service";
import { DeliveryPriceService } from "./delivery-price.service";
import { PVZPickerService } from "./pvz-picker.service";
import { PermitService } from "./permit.service";
import { AddressSanitizerService } from "./address-sanitizer.service";
import { ConfigModule } from "@nestjs/config";
import { CloneLeadService } from "./clone-lead.service";

@Module({
  imports: [ConfigModule],
  providers: [
    PartialReturnService,
    CdekPickupService,
    PrintPdfService,
    DeliveryPriceService,
    PVZPickerService,
    PermitService,
    AddressSanitizerService,
    CloneLeadService,
  ],
  controllers: [WebController],
})
export class WebModule {}
