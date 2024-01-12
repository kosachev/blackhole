import { Module } from "@nestjs/common";
import { AmoService } from "./amo.service";
import { AmoController } from "./amo.controller";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  providers: [AmoService],
  controllers: [AmoController],
})
export class AmoModule {}
