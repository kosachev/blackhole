import { Module } from "@nestjs/common";
import { WebController } from "./web.controller";
import { PartialReturnService } from "./partial-return.service";

@Module({
  providers: [PartialReturnService],
  controllers: [WebController],
})
export class WebModule {}
