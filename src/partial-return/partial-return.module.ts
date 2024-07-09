import { Module } from "@nestjs/common";
import { PartialReturnController } from "./partial-return.controller";
import { PartialReturnService } from "./partial-return.service";

@Module({
  providers: [PartialReturnService],
  controllers: [PartialReturnController],
})
export class PartialReturnModule {}
