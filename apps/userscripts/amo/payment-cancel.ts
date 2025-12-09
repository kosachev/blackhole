import { AMO } from "../../../src/amo/amo.constants";
import { BACKEND_BASE_URL, CFV } from "../common";

export class PaymentCancel {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/payment_cancel`;

  constructor(private leadId: number) {
    console.debug("PAYMENT CANCEL LOADED", leadId);

    $(`div[data-id=${AMO.CUSTOM_FIELD.BANK_STATUS}] > div`)
      .first()
      .append(
        `<span id="payment_cancel" style="margin-left: 5px; cursor: pointer" title="Отменить платеж">✖</span>`,
      );

    $("head").append(
      `<style class="payment_cancel_style" type="text/css">.payment_cancel_loading { animation: rotate 4s infinite; } @keyframes rotate { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) }</style>`,
    );

    CFV(AMO.CUSTOM_FIELD.BANK_STATUS).on("change", this.render);
    CFV(AMO.CUSTOM_FIELD.BANK_PAYMENTID).on("change", this.render);
    $("#payment_cancel").on("click", () => this.sendRequest());

    this.render();
  }

  destructor() {
    console.debug("PAYMENT CANCE DESTRUCTOR", this.leadId);
    CFV(AMO.CUSTOM_FIELD.BANK_STATUS).off("change");
    CFV(AMO.CUSTOM_FIELD.BANK_PAYMENTID).off("change");
    $("#payment_cancel").off("click");
    $("head").find("style.payment_cancel_style").remove();
  }

  render() {
    const paymentStatus = CFV(AMO.CUSTOM_FIELD.BANK_STATUS).val() as string;
    const paymentId = CFV(AMO.CUSTOM_FIELD.BANK_PAYMENTID).val() as string;

    if (paymentStatus === "NEW" && paymentId && paymentId.length > 0) {
      $("#payment_cancel").css("display", "inherit");
    } else {
      $("#payment_cancel").css("display", "none").css("color", "");
    }
  }

  async sendRequest() {
    if ($("#payment_cancel").hasClass("payment_cancel_loading")) return;
    $("#payment_cancel").addClass("payment_cancel_loading");

    const paymentId = CFV(AMO.CUSTOM_FIELD.BANK_PAYMENTID).val() as string;
    if (!paymentId || paymentId.length < 1) return;

    const data = {
      leadId: this.leadId,
      paymentId,
      paymentStatus: CFV(AMO.CUSTOM_FIELD.BANK_STATUS).val() as string,
    };

    console.debug("SEND PAYMENT CANCEL REQUEST", data);

    const res = await fetch(this.BACKEND_URL, {
      method: "POST",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      $("#payment_cancel").css("color", "red").removeClass("payment_cancel_loading");
    } else {
      $("#payment_cancel").css("color", "green").removeClass("payment_cancel_loading");
    }

    setTimeout(this.render, 3000);
  }
}
