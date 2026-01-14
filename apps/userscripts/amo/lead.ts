import { AMO } from "../../../src/amo/amo.constants";
import { Plugin } from "./plugin";
import { CdekPickup } from "./cdek-pickup";
import { DeliveryPrice } from "./delivery-price";
import { ParialReturn } from "./partial-return";
import { PrintPdf } from "./print-pdf";
import { CFV, deliveryTariff, deliveryType, validateIndexCf, validatePVZCf } from "../common";
import { PVZPicker } from "./pvz-picker";
import { LeadPrice } from "./lead-price";
import { Permit } from "./permit";
import { AddressSanitizer } from "./address-sanitizer";
import { Modal } from "./modal";
import { CloneLead } from "./clone-lead";
import { FirstLeadInteraction } from "./first-lead-interaction";
import { PaymentCancel } from "./payment-cancel";
import { Receipt } from "./receipt";

export class Lead {
  private to_destruct: CallableFunction[] = [];
  private plugins: Plugin[] = [];

  constructor(private lead_id: number) {
    if (lead_id === 0 || !lead_id) return;
    console.debug("LEAD LOADED", lead_id);

    // flat check
    this.registerPlugin(new ParialReturn(lead_id));
    this.registerPlugin(new CdekPickup(lead_id));
    this.registerPlugin(new PrintPdf(lead_id));
    this.registerPlugin(new DeliveryPrice(lead_id));
    this.registerPlugin(new PVZPicker(lead_id));
    this.registerPlugin(new LeadPrice(lead_id));
    this.registerPlugin(new Permit(lead_id));
    this.registerPlugin(new AddressSanitizer(lead_id));
    this.registerPlugin(new CloneLead(lead_id));
    this.registerPlugin(new FirstLeadInteraction(lead_id));
    this.registerPlugin(new PaymentCancel(lead_id));
    this.registerPlugin(new Receipt(lead_id));

    this.timezone();
    this.deleteCompanyField();
    this.validateIndexField();
    this.validateDeliveryPVZField();
    this.styles();

    this.to_destruct.push(() => {
      $("body").off("input");
    });
  }

  private registerPlugin(plugin: Plugin) {
    this.plugins.push(plugin);
  }

  destructor() {
    console.debug("LEAD DESTRUCTOR", this.lead_id);
    for (const fn of this.to_destruct) {
      fn();
    }
    for (const plugin of this.plugins) {
      plugin.destructor();
    }
  }

  private timezone() {
    function updateTimezone() {
      console.debug("UPDATE TIMEZONE FIELD");
      const el = CFV(1997729);
      const str = el.val() as string;
      if (!str) return;
      const gmt = parseInt(str.split(" ")[0]);
      if (Number.isInteger(gmt)) {
        const localtime = new Date(Date.now() - 3 * 3600 * 1000 + gmt * 3600 * 1000);
        el.val(
          `${gmt > 0 ? "+" + gmt : gmt} ${localtime.getHours()}:${localtime
            .getMinutes()
            .toString()
            .padStart(2, "0")}`,
        );
      }
    }
    updateTimezone();
    const abort = setInterval(updateTimezone, 10000);
    this.to_destruct.push(() => clearInterval(abort));
  }

  private deleteCompanyField() {
    $('div[class="linked-form__field linked-form__field-company"]').remove();
  }

  private validateIndexField() {
    function check() {
      const delivery_type = deliveryType();
      console.debug("VALIDATE INDEX FIELD", delivery_type);

      if (
        (delivery_type === "Экспресс по России" || delivery_type === "Почта России") &&
        !validateIndexCf()
      ) {
        CFV(AMO.CUSTOM_FIELD.INDEX).parent().parent().addClass("validation-not-valid");
      } else {
        CFV(AMO.CUSTOM_FIELD.INDEX).parent().parent().removeClass("validation-not-valid");
      }
    }
    check();
    CFV(AMO.CUSTOM_FIELD.INDEX).on("input", check);
    CFV(AMO.CUSTOM_FIELD.DELIVERY_TYPE).on("change", check);
    this.to_destruct.push(() => {
      CFV(AMO.CUSTOM_FIELD.INDEX).off("input");
      CFV(AMO.CUSTOM_FIELD.DELIVERY_TYPE).off("change");
    });
  }

  private validateDeliveryPVZField() {
    function check() {
      const delivery_type = deliveryType();
      const delivery_tariff = deliveryTariff();
      console.debug("VALIDATE INDEX FIELD", delivery_type, delivery_tariff);

      if (
        delivery_type === "Экспресс по России" &&
        delivery_tariff === "Склад - Склад" &&
        !validatePVZCf()
      ) {
        CFV(AMO.CUSTOM_FIELD.PVZ).parent().parent().addClass("validation-not-valid");
      } else {
        CFV(AMO.CUSTOM_FIELD.PVZ).parent().parent().removeClass("validation-not-valid");
      }
    }
    check();
    CFV(AMO.CUSTOM_FIELD.PVZ).on("input", check);
    CFV(AMO.CUSTOM_FIELD.DELIVERY_TYPE).on("change", check);
    CFV(AMO.CUSTOM_FIELD.DELIVERY_TARIFF).on("change", check);
    this.to_destruct.push(() => {
      CFV(AMO.CUSTOM_FIELD.PVZ).off("input");
      CFV(AMO.CUSTOM_FIELD.DELIVERY_TYPE).off("change");
      CFV(AMO.CUSTOM_FIELD.DELIVERY_TARIFF).off("change");
    });
  }

  private styles() {
    let styles = `
        #widgets_block {
          display: none !important;
        }
        #card_holder {
          padding-right: 0 !important;
        }
        li.multisuggest__list-item {
          max-width: 130px;
        }
        ${Modal.styles}
    `;

    for (const plugin of this.plugins) {
      styles += plugin.style() + "\n";
    }
    if ($(".userstyles-lead").length === 0) {
      $("head").append(/*html*/ `
        <style class="userstyles-lead" type="text/css">
          ${styles}
        </style>`);
    }
  }
}
