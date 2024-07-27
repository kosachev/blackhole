import { Module } from "@nestjs/common";
import { WebController } from "./web.controller";
import { PartialReturnService } from "./partial-return.service";
import { CdekPickupService } from "./cdek-pickup.service";
import { PrintPdfService } from "./print-pdf.service";
import { DeliveryPriceService } from "./delivery-price.service";

@Module({
  providers: [PartialReturnService, CdekPickupService, PrintPdfService, DeliveryPriceService],
  controllers: [WebController],
})
export class WebModule {}
