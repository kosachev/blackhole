import { Global, Module } from "@nestjs/common";
import { AmoService } from "./amo.service";
import { AmoController } from "./amo.controller";
import { ConfigModule } from "@nestjs/config";
import { LeadStatusWebhook } from "./webhooks/lead-status.webhook";
import { LeadAddWebhook } from "./webhooks/lead-add.webhook";
import { LeadChangeWebhook } from "./webhooks/lead-change.webhook";
import { VisitReminderService } from "./visit-reminder.service";
import { LeadCreateService } from "./lead-create.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    AmoService,
    LeadStatusWebhook,
    LeadAddWebhook,
    LeadChangeWebhook,
    VisitReminderService,
    LeadCreateService,
  ],
  controllers: [AmoController],
  exports: [AmoService],
})
export class AmoModule {}
