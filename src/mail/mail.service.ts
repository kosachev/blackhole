import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";

@Injectable()
export class MailService {
  constructor(private mailer: MailerService) {}

  async sendWelcome(email: string, url: string) {
    await this.mailer.sendMail({
      to: email,
      subject: "Welcome to Our App!",
      template: "./example.hbs",
      context: {
        name: email,
        url,
      },
    });
  }
}
