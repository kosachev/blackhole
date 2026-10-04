import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";

import { normalizePhone, SmsService } from "../sms/sms.service";

export type RequestSms = {
  lead_id: number;
  phone: string;
  text: string;
};

@Injectable()
export class SmsUserScriptService {
  protected readonly logger: Logger = new Logger(SmsUserScriptService.name);

  constructor(private readonly sms: SmsService) {}

  async handler(data: RequestSms): Promise<{ uuid: string }> {
    const phone = normalizePhone(data?.phone);
    const text = (data?.text ?? "").trim();

    if (!Number.isFinite(data?.lead_id) || data.lead_id <= 0 || !phone || !text) {
      throw new BadRequestException("Invalid data");
    }

    try {
      return { uuid: await this.sms.send(data.lead_id, phone, text) };
    } catch (error) {
      this.logger.error(
        `USERSCRIPT_SMS_ERROR, lead_id: ${data.lead_id}, to: ${phone}, error: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(error.message);
    }
  }
}
