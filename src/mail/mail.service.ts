import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";
import { deliveryType } from "client/common";

type invoice = {
  name: string;
  address: string;
  phone: string;
  email: string;
  deliveryType: string;
  orderNumber: string;
  items: any;
  totalPrice: number;
  discount?: number;
  discountedPrice?: number;
  prepayment: number;
};

@Injectable()
export class MailService {
  constructor(private mailer: MailerService) {}

  async invoiceCdek(params: invoice) {
    await this.mailer.sendMail({
      to: params.email,
      subject: "Реквизиты для оплаты заказа №" + params.orderNumber,
      template: "./invoiceCdek.hbs",
      context: {
        name: params.name,
        address: params.address,
        phone: params.phone,
        email: params.email,
        deliveryType: params.deliveryType,
        orderNumber: params.orderNumber,
        items:params.items,
        totalPrice: params.totalPrice,
        discount: params.discount,
        discountedPrice: params.discountedPrice,
        prepayment: params.prepayment
      },
    });
  }
  async invoicePost(params: invoice) {
    await this.mailer.sendMail({
      to: params.email,
      subject: "Реквизиты для оплаты заказа №" + params.orderNumber,
      template: "./invoicePost.hbs",
      context: {
        name: params.name,
        address: params.address,
        phone: params.phone,
        email: params.email,
        deliveryType: params.deliveryType,
        orderNumber: params.orderNumber,
        items:params.items,
        totalPrice: params.totalPrice,
        discount: params.discount,
        discountedPrice: params.discountedPrice,
        prepayment: params.prepayment
      },
    });
  }
}
