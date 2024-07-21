import { Module } from "@nestjs/common";
import { WebController } from "./web.controller";
import { PartialReturnService } from "./partial-return.service";
import { CdekPickupService } from "./cdek-pickup.service";
import { PrintPdfService } from "./print-pdf.service";

@Module({
  providers: [PartialReturnService, CdekPickupService, PrintPdfService],
  controllers: [WebController],
})
export class WebModule {}
