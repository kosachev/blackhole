import { convert } from "number-to-words-ru";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PDFBuilder } from "./lib/pdf-builder.lib";

import { wordWrap } from "../utils/word-wrap.function";

type Post7p = {
  sender?: string;
  sender_address?: string;
  sender_index?: string;
  sender_phone?: string;
  recipient: string;
  recipient_address: string;
  recipient_phone?: string;
  recipient_index: string;
  sum_insured: number;
  sum_cash_on_delivery: number;
};

@Injectable()
export class PDFService {
  private readonly builder: PDFBuilder = new PDFBuilder("./assets/roboto.ttf");

  constructor(private readonly config: ConfigService) {}

  async post7p(params: Post7p): Promise<Uint8Array> {
    const sender_address = wordWrap(
      params.sender_address ?? this.config.get<string>("OWNER_POST_ADDRESS"),
      53,
    );
    const recipient_address = wordWrap(params.recipient_address, 55);

    return this.builder.fillPost7p({
      sender: params.sender ?? this.config.get<string>("OWNER_SHORT_NAME"),
      sender_index: params.sender_index ?? this.config.get<string>("OWNER_POST_INDEX"),
      sender_address: sender_address[0],
      sender_address2: sender_address[1],
      sender_address3: sender_address[2],
      recipient: params.recipient,
      recipient_index: params.recipient_index,
      recipient_phone: params.recipient_phone,
      recipient_address: recipient_address[0],
      recipient_address2: recipient_address[1],
      recipient_address3: recipient_address[2],
      sum_insured:
        params.sum_insured +
        " " +
        convert(params.sum_insured, {
          showNumberParts: { fractional: false },
        }).toLocaleLowerCase(),
      sum_cash_on_delivery:
        params.sum_cash_on_delivery +
        " " +
        convert(params.sum_cash_on_delivery).toLocaleLowerCase(),
    });
  }
}
