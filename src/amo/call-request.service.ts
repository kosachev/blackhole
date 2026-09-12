import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { AmoService } from "./amo.service";
import { AMO } from "./amo.constants";

export type CallRequest = {
  name: string;
  phone: string;
  comment?: string;
};

@Injectable()
export class CallRequestService {
  protected readonly logger: Logger = new Logger(CallRequestService.name);

  constructor(private readonly amo: AmoService) {}

  async callRequesthandler(data: CallRequest) {
    this.logger.log(`CALL_REQUEST, name: ${data.name}, phone: ${data.phone}`);

    const errors = this.validateRequieredFields(data);
    if (errors) {
      this.logger.error(
        `CALL_REQUEST, failed to create call request, validation errors: ${errors}`,
      );
      throw new BadRequestException(errors);
    }

    const lead = await this.amo.client.lead.addComplex([
      {
        name: "Звонок " + data.name,
        custom_fields_values: [
          {
            field_id: AMO.CUSTOM_FIELD.COMMENT_CLIENT,
            values: [{ value: data.comment ?? "" }],
          },
        ],
        _embedded: {
          contacts: [
            {
              name: data.name,
              custom_fields_values: [
                {
                  field_id: AMO.CONTACT.PHONE,
                  values: [{ value: data.phone }],
                },
              ],
            },
          ],
          metadata: {
            // @ts-ignore
            category: "forms",
            form_page: "Заказ звонка",
            form_name: "NEST",
            form_sent_at: Math.round(Date.now() / 1000),
            form_id: "69",
          },
        },
      },
    ]);

    if (!lead) {
      this.logger.error(`CALL_REQUEST, failed to create call request, amo error`);
      throw new InternalServerErrorException("Failed to create call request, amo error");
    }
  }

  private validateRequieredFields(data: CallRequest): string | undefined {
    const errors: string[] = [];

    if (!data.name) {
      errors.push("name");
    }
    if (!data.phone || data.phone?.length < 3) {
      errors.push("phone");
    }

    return errors.length > 0 ? `missing requiered fields: ${errors.join(", ")}` : undefined;
  }
}
