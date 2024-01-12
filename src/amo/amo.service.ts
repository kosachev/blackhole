import { Amo, Lead } from "@shevernitskiy/amo";
import { readFileSync, writeFileSync } from "node:fs";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AmoService {
  private instance: Amo;

  constructor(private readonly config: ConfigService) {
    const token = JSON.parse(readFileSync("./amo_token.json", "utf-8"));

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
          writeFileSync("./amo_token.json", JSON.stringify(new_token, null, 2), "utf-8"),
      },
    );

    this.instance.on("leads:add", this.lead_add);
  }

  get client(): Amo {
    return this.instance;
  }

  // TODO: implement logic
  private lead_add(data: Lead) {
    console.log("lead_add", data);
  }
}
