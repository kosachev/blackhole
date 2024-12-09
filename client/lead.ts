import { AMO } from "../src/amo/amo.constants";
import { CdekPickup } from "./cdek-pickup";
import { DeliveryPrice } from "./delivery-price";
import { ParialReturn } from "./partial-return";
import { PrintPdf } from "./print-pdf";
import { CFV, deliveryTariff, deliveryType, validateIndexCf, validatePVZCf } from "./common";
import { PVZPicker } from "./pvz-picker";
import { LeadPrice } from "./lead-price";
import { Permit } from "./permit";
import { AddressSanitizer } from "./address-sanitizer";
import { Modal } from "./modal";
import { CloneLead } from "./clone-lead";

export class Lead {
  private to_destruct: CallableFunction[] = [];

  constructor(private lead_id: number) {
    if (lead_id === 0 || !lead_id) return;
    console.debug("LEAD LOADED", lead_id);

    // flat check
    const partial_return = new ParialReturn(lead_id);
    const cdek_pickup = new CdekPickup(lead_id);
    const print_pdf = new PrintPdf(lead_id);
    const delivery_price = new DeliveryPrice(lead_id);
    const pvz_picker = new PVZPicker(lead_id);
    const lead_price = new LeadPrice(lead_id);
    const permit = new Permit(lead_id);
    const address_sanitizer = new AddressSanitizer(lead_id);
    const _clone_lead = new CloneLead(lead_id);

    this.timezone();
    this.deleteCompanyField();
    this.validateIndexField();
    this.validateDeliveryPVZField();
    this.styles();

    this.to_destruct.push(() => {
      $("body").off("input");
      partial_return.destructor();
      cdek_pickup.destructor();
      print_pdf.destructor();
      delivery_price.destructor();
      pvz_picker.destructor();
      lead_price.destructor();
      permit.destructor();
      address_sanitizer.destructor();
    });
  }

  destructor() {
    console.debug("LEAD DESTRUCTOR", this.lead_id);
    for (const fn of this.to_destruct) {
      fn();
    }
    $("head").find("style.userstyles").remove();
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
          `${gmt > 0 ? "+" + gmt : gmt} ${localtime.getHours()}:${localtime.getMinutes().toString().padStart(2, "0")}`,
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
    $("head").append(/*html*/ `
      <style class="userstyles" type="text/css">
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
      </style>`);
  }
}
