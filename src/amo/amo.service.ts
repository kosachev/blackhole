import { readFileSync, writeFileSync } from "node:fs";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Amo, ApiError, AuthError, HttpError, NoContentError } from "@shevernitskiy/amo";

@Injectable()
export class AmoService {
  private readonly logger = new Logger(AmoService.name);
  private instance: Amo;

  constructor(private readonly config: ConfigService) {
    const token = JSON.parse(readFileSync(this.config.get<string>("AMO_TOKEN_PATH"), "utf-8"));

    this.instance = new Amo(
      this.config.get<string>("AMO_DOMAIN"),
      {
        ...token,
        client_id: this.config.get<string>("AMO_CLIENT_ID"),
        client_secret: this.config.get<string>("AMO_SECRET"),
        redirect_uri: this.config.get<string>("AMO_REDIRECT_URI"),
      },
      {
        on_token: (new_token) =>
          writeFileSync(
            this.config.get<string>("AMO_TOKEN_PATH"),
            JSON.stringify(new_token, null, 2),
            "utf-8",
          ),
        on_error: (error) => {
          if (error instanceof ApiError || error instanceof AuthError) {
            this.logger.error(error.message, error.response);
          } else if (error instanceof NoContentError || error instanceof HttpError) {
            this.logger.error(error.message, error.stack);
          } else {
            this.logger.error("Unknown error", error);
          }
        },
      },
    );
  }

  get client(): Amo {
    return this.instance;
  }
}
