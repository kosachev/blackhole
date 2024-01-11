import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CdekService } from "./cdek.service";
import { CdekController } from "./cdek.controller";

@Module({
  imports: [ConfigModule],
  providers: [CdekService],
  controllers: [CdekController],
})
export class CdekModule {}
