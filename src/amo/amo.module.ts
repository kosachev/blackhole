import { Module } from "@nestjs/common";
import { AmoService } from "./amo.service";
import { AmoController } from "./amo.controller";
import { ConfigModule } from "@nestjs/config";
import { LeadAddWebhook } from "./webhooks/lead-add.webhook";

@Module({
  imports: [ConfigModule],
  providers: [AmoService, LeadAddWebhook],
  controllers: [AmoController],
})
export class AmoModule {}
