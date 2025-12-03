import { convert } from "number-to-words-ru";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PDFBuilder } from "./lib/pdf-builder.lib";

import { wordWrap } from "../utils/word-wrap.function";

import roboto from "../../assets/roboto.ttf" with { type: "file" };
import robotoBold from "../../assets/roboto-bold.ttf" with { type: "file" };

type Post7p = {
  sender?: string;
  sender_address?: string;
  sender_index?: string;
  sender_phone?: string;
  recipient: string;
  recipient_address: string;
  recipient_phone?: number;
  recipient_index: number;
  sum_insured: number;
  sum_cash_on_delivery: number;
};

type Post112ep = {
  sum: number;
  recipient?: string;
  recipient_phone?: number;
  recipient_address?: string;
  recipient_index?: number;
  recipient_inn?: number;
  recipient_correspondent_account?: number;
  recipient_bank_name?: string;
  recipient_cheking_account?: number;
  recipient_bik?: number;
};

type Post7p112ep = {
  recipient: string;
  recipient_address: string;
  recipient_phone?: number;
  recipient_index: number;
  sum: number;
  sum_cash_on_delivery: number;
};

type Invoice = {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_time?: string;
  delivery_cost?: number;
  payment_type?: string;
  goods: {
    name: string;
    price: number;
    quantity: number;
  }[];
  discount?: string;
};

@Injectable()
export class PDFService {
  private readonly builder: PDFBuilder = new PDFBuilder(roboto, robotoBold);

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
      recipient_index: params.recipient_index?.toString(),
      recipient_phone: params.recipient_phone?.toString(),
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

  async post112p(params: Post112ep): Promise<Uint8Array> {
    return this.builder.fillPost112ep({
      sum: params.sum.toString(),
      kop: "00",
      sum_words: convert(params.sum).toLocaleLowerCase(),
      recipient_phone:
        params.recipient_phone?.toString() ?? this.config.get<string>("OWNER_NOTIFICATION_PHONE"),
      recipient: params.recipient ?? this.config.get<string>("OWNER_IP_NAME"),
      recipient_address: params.recipient_address ?? this.config.get<string>("OWNER_TOWN"),
      recipient_index:
        params.recipient_index?.toString() ?? this.config.get<string>("OWNER_POST_INDEX"),
      recipient_inn: params.recipient_inn?.toString() ?? this.config.get<string>("OWNER_INN"),
      recipient_correspondent_account:
        params.recipient_correspondent_account?.toString() ??
        this.config.get<string>("OWNER_CORRESPONDENT_ACCOUNT"),
      recipient_bank_name: params.recipient_bank_name ?? this.config.get<string>("OWNER_BANK_NAME"),
      recipient_cheking_account:
        params.recipient_cheking_account?.toString() ??
        this.config.get<string>("OWNER_CHECKING_ACCOUNT"),
      recipient_bik: params.recipient_bik?.toString() ?? this.config.get<string>("OWNER_BIK"),
    });
  }

  async post7p112ep(params: Post7p112ep): Promise<Uint8Array> {
    const recipient_address = wordWrap(params.recipient_address, 55);
    const pdfs = await Promise.all([
      this.builder.fillPost7pDoc({
        sender: this.config.get<string>("OWNER_SHORT_NAME"),
        sender_index: this.config.get<string>("OWNER_POST_INDEX"),
        sender_address: this.config.get<string>("OWNER_POST_ADDRESS"),
        recipient: params.recipient,
        recipient_index: params.recipient_index?.toString(),
        recipient_phone: params.recipient_phone?.toString(),
        recipient_address: recipient_address[0],
        recipient_address2: recipient_address[1],
        recipient_address3: recipient_address[2],
        sum_insured:
          params.sum.toString() +
          " " +
          convert(params.sum, { showNumberParts: { fractional: false } }).toLocaleLowerCase(),
        sum_cash_on_delivery:
          params.sum_cash_on_delivery.toString() +
          " " +
          convert(params.sum_cash_on_delivery).toLocaleLowerCase(),
      }),
      this.builder.fillPost112epDoc({
        sum: params.sum_cash_on_delivery.toString(),
        kop: "00",
        sum_words: convert(params.sum_cash_on_delivery).toLocaleLowerCase(),
        recipient_phone: this.config.get<string>("OWNER_NOTIFICATION_PHONE"),
        recipient: this.config.get<string>("OWNER_IP_NAME"),
        recipient_address: this.config.get<string>("OWNER_TOWN"),
        recipient_index: this.config.get<string>("OWNER_POST_INDEX"),
        recipient_inn: this.config.get<string>("OWNER_INN"),
        recipient_correspondent_account: this.config.get<string>("OWNER_CORRESPONDENT_ACCOUNT"),
        recipient_bank_name: this.config.get<string>("OWNER_BANK_NAME"),
        recipient_cheking_account: this.config.get<string>("OWNER_CHECKING_ACCOUNT"),
        recipient_bik: this.config.get<string>("OWNER_BIK"),
      }),
    ]);

    return (await this.builder.mergePdf(pdfs)).save();
  }

  async invoice(params: Invoice): Promise<Uint8Array> {
    return this.builder.fillInvoice({
      header: `Продавец: ${this.config.get<string>("OWNER_SELLER_NAME")}
ИП ${this.config.get<string>("OWNER_SHORT_NAME")}, ИНН ${this.config.get<string>("OWNER_INN")}
Адрес: ${this.config.get<string>("OWNER_SHOP_ADDRESS")}`,
      id: params.order_id,
      date: new Date().toLocaleDateString(),
      lead: `Покупатель: ${params.customer_name}
Телефон: ${params.customer_phone}
Адрес: ${params.customer_address}
Время доставки: ${params.delivery_time ?? ""}
Способ оплаты: ${params.payment_type ?? ""}`,
      goods: params.goods,
      delivery_cost: params.delivery_cost,
      discount: params.discount,
    });
  }
}
