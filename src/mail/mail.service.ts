import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";

type InvoiceParams = {
  name: string;
  address: string;
  phone: string;
  email: string;
  delivery_type: string;
  order_number: string;
  items: any;
  total_price: number;
  discount?: number;
  discounted_price?: number;
  prepayment: number;
};

@Injectable()
export class MailService {
  constructor(private mailer: MailerService) {}

  async invoice(params: InvoiceParams) {
    if (params.delivery_type === "Экспресс по России") {
      await this.mailer.sendMail({
        to: params.email,
        subject: "Реквизиты для оплаты заказа №" + params.order_number,
        template: "./invoice-cdek.hbs",
        context: {
          name: params.name,
          address: params.address,
          phone: params.phone,
          email: params.email,
          deliveryType: params.delivery_type,
          orderNumber: params.order_number,
          items: params.items,
          totalPrice: params.total_price,
          discount: params.discount,
          discountedPrice: params.discounted_price,
          prepayment: params.prepayment,
        },
      });
    }
    if (params.delivery_type === "Почта России") {
      await this.mailer.sendMail({
        to: params.email,
        subject: "Реквизиты для оплаты заказа №" + params.order_number,
        template: "./invoice-post.hbs",
        context: {
          name: params.name,
          address: params.address,
          phone: params.phone,
          email: params.email,
          deliveryType: params.delivery_type,
          orderNumber: params.order_number,
          items: params.items,
          totalPrice: params.total_price,
          discount: params.discount,
          discountedPrice: params.discounted_price,
          prepayment: params.prepayment,
        },
      });
    }
  }
}
