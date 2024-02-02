import { Global, Module } from "@nestjs/common";
import { GoogleSheetsService } from "./google-sheets.service";

@Global()
@Module({
  providers: [GoogleSheetsService],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule {}
