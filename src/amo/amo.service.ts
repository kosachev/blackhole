import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Amo, ApiError, AuthError, HttpError, NoContentError } from "@shevernitskiy/amo";

@Injectable()
export class AmoService {
  private readonly logger = new Logger(AmoService.name);
  private instance: Amo;

  constructor(private readonly config: ConfigService) {
    const token = JSON.parse(
      readFileSync(resolve(process.cwd(), this.config.get<string>("AMO_TOKEN_PATH")), "utf-8"),
    );

    this.instance = new Amo(
      this.config.get<string>("AMO_DOMAIN"),
      {
        ...token,
        client_id: this.config.get<string>("AMO_CLIENT_ID"),
        client_secret: this.config.get<string>("AMO_SECRET"),
        redirect_uri: this.config.get<string>("AMO_REDIRECT_URI"),
      },
      {
        on_token: (new_token) => {
          writeFileSync(
            resolve(process.cwd(), this.config.get<string>("AMO_TOKEN_PATH")),
            JSON.stringify(new_token, null, 2),
            "utf-8",
          );
          this.logger.log("Token refreshed");
        },
        on_error: (error) => {
          if (error instanceof NoContentError) {
            return;
          } else if (error instanceof ApiError || error instanceof AuthError) {
            this.logger.error(
              `${error.message}\n${JSON.stringify(error.response, null, 2)}`,
              error.stack,
            );
          } else if (error instanceof HttpError) {
            this.logger.error(error.message, error.stack);
          } else {
            this.logger.error("Unknown error", error.stack);
          }
        },
      },
    );
  }

  get client(): Amo {
    return this.instance;
  }
}
