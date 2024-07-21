import { Module } from "@nestjs/common";
import { WebController } from "./web.controller";
import { PartialReturnService } from "./partial-return.service";
import { CdekPickupService } from "./cdek-pickup.service";

@Module({
  providers: [PartialReturnService, CdekPickupService],
  controllers: [WebController],
})
export class WebModule {}
