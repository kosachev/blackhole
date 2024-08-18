import { MailerService } from "@nestjs-modules/mailer";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import { readFileSync, readdir } from "node:fs";
import { join } from "node:path";
import * as Handlebars from "handlebars";
import Imap = require("imap");

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
};

type PaymentConfirmParams = {
  email: string;
  order_number: string;
};

type OrderSendParams = {
  email: string;
  order_number: string;
  delivery_type: string;
  track_code: string;
};

@Injectable()
export class MailService {
  private templates: Map<string, HandlebarsTemplateDelegate<any>>;

  constructor(
    private config: ConfigService,
    private mailer: MailerService,
  ) {
    readdir("./templates", (err, files) => {
      this.templates = new Map<string, HandlebarsTemplateDelegate<any>>();
      for (const file of files) {
        const template = Handlebars.compile(readFileSync(join("./templates", file)).toString());
        this.templates.set(`./${file}`, template);
      }
    });
  }

  imap(params: { to: string; subject: string; template: string; context: any }) {
    const imap = new Imap({
      user: this.config.get("MAIL_USER"),
      password: this.config.get("MAIL_PASSWORD"),
      host: this.config.get("MAIL_IMAP_HOST"),
      port: this.config.get("MAIL_IMAP_PORT"),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.openBox("Отправленные", false, () => {
        const html = this.templates.get(params.template)(params.context);
        const data =
          "MIME-Version: 1.0\r\n" +
          "Content-Type: text/html; charset=UTF-8\r\n" +
          `From: "${this.config.get("OWNER_SELLER_NAME")}" <${this.config.get("MAIL_FROM")}>\r\n` +
          `To: <${params.to}>\r\n` +
          `Subject: ${params.subject}\r\n\r\n` +
          html +
          "\r\n";

        imap.append(data, () => imap.end());
      });
    });

    imap.connect();
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

    const mail = {
      to: params.email,
      subject: "Реквизиты для оплаты заказа №" + params.order_number,
      template:
        params.delivery_type === "Экспресс по России" ? "./invoice-cdek.hbs" : "./invoice-post.hbs",
      context: {
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
      },
    };

    await Promise.all([this.mailer.sendMail(mail), this.imap(mail)]);
  }

  async prepaymentConfirm(params: PaymentConfirmParams) {
    const mail = {
      to: params.email,
      subject: "Оплата заказа №" + params.order_number,
      template: "./prepayment-confirm.hbs",
      context: {
        order_number: params.order_number,
      },
    };

    await Promise.all([this.mailer.sendMail(mail), this.imap(mail)]);
  }

  async orderSend(params: OrderSendParams) {
    const mail = {
      to: params.email,
      subject: "Заказа №" + params.order_number + " отправлен",
      template:
        params.delivery_type === "Экспресс по России"
          ? "./order-cdek-send.hbs"
          : "./order-post-send.hbs",
      context: {
        order_number: params.order_number,
        track_code: params.track_code,
      },
    };

    await Promise.all([this.mailer.sendMail(mail), this.imap(mail)]);
  }
}
