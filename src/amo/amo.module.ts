import { Global, Module } from "@nestjs/common";
import { AmoService } from "./amo.service";
import { AmoController } from "./amo.controller";
import { ConfigModule } from "@nestjs/config";
import { LeadStatusWebhook } from "./webhooks/lead-status.webhook";
import { LeadAddWebhook } from "./webhooks/lead-add.webhook";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AmoService, LeadStatusWebhook, LeadAddWebhook],
  controllers: [AmoController],
  exports: [AmoService],
})
export class AmoModule {}
