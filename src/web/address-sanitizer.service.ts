import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type RequestAddressSanitizer = {
  lead_id: number;
  query: string;
};

export type SanitizedAddress = {
  index: string;
  city: string;
  street: string;
  building: string;
  flat: string;
};

@Injectable()
export class AddressSanitizerService {
  private readonly logger = new Logger(AddressSanitizerService.name);

  constructor(private readonly config: ConfigService) {}

  async handler(data: RequestAddressSanitizer): Promise<SanitizedAddress> {
    this.logger.log(`USERSCRIPT_ADDRESS_SANITIZER, leadid: ${data.lead_id}, query: ${data.query}`);

    try {
      const res = await fetch("https://cleaner.dadata.ru/api/v1/clean/address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${this.config.get<string>("DADATA_API_KEY")}`,
          "X-Secret": this.config.get<string>("DADATA_SECRET_KEY"),
        },
        body: JSON.stringify([data.query]),
      });

      const [parsed_data] = await res.json();

      return {
        index: parsed_data.postal_code ?? "",
        city: parsed_data.city
          ? (parsed_data.city_type ? parsed_data.city_type + ". " : "") + parsed_data.city
          : "",
        street: parsed_data.street
          ? (parsed_data.street_type ? parsed_data.street_type + ". " : "") + parsed_data.street
          : "",
        building: parsed_data.house
          ? (parsed_data.house_type ? parsed_data.house_type + ". " : "") + parsed_data.house
          : "",
        flat: parsed_data.flat
          ? (parsed_data.flat_type ? parsed_data.flat_type + ". " : "") + parsed_data.flat
          : "",
      };
    } catch (err) {
      this.logger.error("ADDRESS SANITIZER ERROR", err);
      throw err;
    }
  }
}
