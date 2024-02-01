import { Global, Module } from "@nestjs/common";
import { PDFService } from "./pdf.service";

@Global()
@Module({
  providers: [PDFService],
  exports: [PDFService],
})
export class PDFModule {}
