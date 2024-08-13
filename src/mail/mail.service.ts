import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";
import { deliveryType } from "client/common";

type Welcome = {
  name: string;
  address: string;
  phone: string;
  email: string;
  deliveryType: string;
  products: any;
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

  async sendWelcome(params: Welcome) {
    await this.mailer.sendMail({
      to: params.email,
      subject: "Реквизиты",
      template: "./invoceCdek.hbs",
      context: {
        name: params.name,
        address: params.address,
        phone: params.phone,
        email: params.email,
        deliveryType: params.deliveryType,
        products: params.products,
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
