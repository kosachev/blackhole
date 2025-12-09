import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import { ImapFlow } from "imapflow";
import Handlebars from "handlebars";
import nodemailer from "nodemailer";

import invoiceCdekV2 from "../../templates/invoice-cdek-v2.hbs" with { type: "text" };
import invoicePostV2 from "../../templates/invoice-post-v2.hbs" with { type: "text" };
import orderCdekSendV2 from "../../templates/order-cdek-send-v2.hbs" with { type: "text" };
import orderPostSendV2 from "../../templates/order-post-send-v2.hbs" with { type: "text" };
import prepaymentConfirmV2 from "../../templates/prepayment-confirm-v2.hbs" with { type: "text" };

type InvoiceParams = {
  name: string;
  address: string;
  phone: string;
  email: string;
  delivery_type: string;
  order_number: string;
  goods: {
    name: string;
    quantity: number;
    price: number;
  }[];
  total_price: number;
  discount?: string;
  prepayment: number;
  PaymentURL: string;
  is_gerdacollection?: boolean;
};

type PaymentConfirmParams = {
  email: string;
  order_number: string;
  is_gerdacollection?: boolean;
};

type OrderSendParams = {
  email: string;
  order_number: string;
  delivery_type: string;
  track_code: string;
  is_gerdacollection?: boolean;
};

@Injectable()
export class MailService {
  private templates: Map<string, HandlebarsTemplateDelegate<any>>;
  private mailer: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.templates = new Map<string, HandlebarsTemplateDelegate<any>>([
      ["./invoice-cdek-v2.hbs", Handlebars.compile(invoiceCdekV2)],
      ["./invoice-post-v2.hbs", Handlebars.compile(invoicePostV2)],
      ["./order-cdek-send-v2.hbs", Handlebars.compile(orderCdekSendV2)],
      ["./order-post-send-v2.hbs", Handlebars.compile(orderPostSendV2)],
      ["./prepayment-confirm-v2.hbs", Handlebars.compile(prepaymentConfirmV2)],
    ]);

    this.mailer = nodemailer.createTransport({
      host: this.config.get<string>("MAIL_HOST"),
      port: this.config.get<number>("MAIL_PORT"),
      secure: true,
      ignoreTLS: false,
      auth: {
        user: this.config.get<string>("MAIL_USER"),
        pass: this.config.get<string>("MAIL_PASSWORD"),
      },
    });
  }

  async imap(params: { from: string; to: string; subject: string; html: string }): Promise<void> {
    const client = new ImapFlow({
      host: this.config.get("MAIL_IMAP_HOST"),
      port: this.config.get("MAIL_IMAP_PORT"),
      secure: true,
      auth: {
        user: this.config.get("MAIL_USER"),
        pass: this.config.get("MAIL_PASSWORD"),
      },
      tls: { rejectUnauthorized: false },
      logger: false,
    });

    try {
      await client.connect();

      const messageSource = [
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8",
        `From: "${this.config.get("OWNER_SELLER_NAME")}" <${this.config.get("MAIL_FROM")}>`,
        `To: <${params.to}>`,
        `Subject: ${params.subject}`,
        "",
        params.html,
      ].join("\r\n");
      const folderPath = this.config.get("MAIL_IMAP_PATH");

      await client.append(folderPath, messageSource);
    } finally {
      await client.logout();
    }
  }

  async invoice(params: InvoiceParams) {
    if (params.delivery_type !== "Экспресс по России" && params.delivery_type !== "Почта России") {
      throw new Error("Неизвестный тип доставки");
    }
    if (params.goods.length === 0) {
      throw new Error("Нет товаров в заказе");
    }

    let discount_type: "percent" | "fixed" = "fixed";
    let discount_value = 0;
    if (params.discount?.includes("%")) {
      discount_type = "percent";
      discount_value = Number(params.discount.replaceAll("%", ""));
    } else {
      discount_type = "fixed";
      discount_value = params.discount && params.discount !== "" ? Number(params.discount) : 0;
    }

    if (isNaN(discount_value)) {
      throw new Error("Неверный формат скидки");
    }

    const goods = params.goods.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      sum: item.price * item.quantity,
    }));

    const discounted_price =
      discount_type === "percent"
        ? params.total_price * (1 - discount_value / 100)
        : params.total_price - discount_value;

    const template =
      params.delivery_type === "Экспресс по России"
        ? "./invoice-cdek-v2.hbs"
        : "./invoice-post-v2.hbs";

    const mail = {
      from: `"${this.config.get("OWNER_SELLER_NAME")}" <${this.config.get("MAIL_FROM")}>`,
      to: params.email,
      subject: "Реквизиты для оплаты заказа №" + params.order_number,
      html: this.templates.get(template)({
        name: params.name,
        address: params.address,
        phone: params.phone,
        email: params.email,
        delivery_type: params.delivery_type,
        order_number: params.order_number,
        goods: goods,
        total_price: params.total_price,
        discount: params.discount,
        discounted_price: discounted_price,
        prepayment: params.prepayment,
        PaymentURL: params.PaymentURL,
        is_gerdacollection: params.is_gerdacollection || false,
      }),
    };

    await Promise.all([this.mailer.sendMail(mail), this.imap(mail)]);
  }

  async prepaymentConfirm(params: PaymentConfirmParams) {
    const mail = {
      from: `"${this.config.get("OWNER_SELLER_NAME")}" <${this.config.get("MAIL_FROM")}>`,
      to: params.email,
      subject: "Оплата заказа №" + params.order_number,
      html: this.templates.get("./prepayment-confirm-v2.hbs")({
        order_number: params.order_number,
        is_gerdacollection: params.is_gerdacollection || false,
      }),
    };

    await Promise.all([this.mailer.sendMail(mail), this.imap(mail)]);
  }

  async orderSend(params: OrderSendParams) {
    const template =
      params.delivery_type === "Экспресс по России"
        ? "./order-cdek-send-v2.hbs"
        : "./order-post-send-v2.hbs";

    const mail = {
      from: `"${this.config.get("OWNER_SELLER_NAME")}" <${this.config.get("MAIL_FROM")}>`,
      to: params.email,
      subject: "Заказ №" + params.order_number + " отправлен",
      html: this.templates.get(template)({
        order_number: params.order_number,
        track_code: params.track_code,
        delivery_type: params.delivery_type,
        is_gerdacollection: params.is_gerdacollection || false,
      }),
    };

    await Promise.all([this.mailer.sendMail(mail), this.imap(mail)]);
  }
}
