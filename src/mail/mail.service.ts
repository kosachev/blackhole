import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";

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
  constructor(private mailer: MailerService) {}

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

    await this.mailer.sendMail({
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
    });
  }

  async prepaymentConfirm(params: PaymentConfirmParams) {
    await this.mailer.sendMail({
      to: params.email,
      subject: "Оплата заказа №" + params.order_number,
      template: "./prepayment-confirm.hbs",
      context: {
        order_number: params.order_number,
      },
    });
  }

  async orderSend(params: OrderSendParams) {
    await this.mailer.sendMail({
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
    });
  }
}
