import { UpdatePrintForm } from "cdek/src/types/api/webhook";
import { Injectable } from "@nestjs/common";
import { AbstractWebhook } from "./abstract.webhook";

@Injectable()
export class PrintFormWebhook extends AbstractWebhook {
  async handle(data: UpdatePrintForm) {
    try {
      const leadData = this.cdek_service.getPrintformToLead(data.uuid);

      if (!leadData) {
        throw new Error(`leadData not found, uuid: ${data.uuid}`);
      }

      const { leadId, cdekNumber } = leadData;

      const fileStream = await this.cdek.downloadOrderReceipt(data.uuid);
      if (!fileStream) {
        throw new Error(`can't get file from CDEK, uuid: ${data.uuid}, leadId: ${leadId}`);
      }

      const buffer = Buffer.from(await new Response(fileStream).arrayBuffer());
      const yadisk_url = await this.yadisk.upload(`СДЭК_${cdekNumber}.pdf`, buffer);
      this.logger.log(`CDEK_PRINT_FORM, cdek_number: ${cdekNumber}, yadisk: ${yadisk_url}`);

      await this.amo.note.addNotes("leads", [
        {
          entity_id: leadId,
          note_type: "common",
          params: {
            text: `✎ СДЕК: Форма для печати ${yadisk_url}`,
          },
        },
      ]);
    } catch (error) {
      this.logger.error(`CDEK_WEBHOOK_PRINT_FORM_ERROR ${error.message}`);
    }
  }
}
