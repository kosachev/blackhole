import { CdekPickup } from "./cdek-pickup";
import { ParialReturn } from "./partial-return";
import { PrintPdf } from "./print-pdf";
import { CFV } from "./utils";

export class Lead {
  to_destruct: CallableFunction[] = [];

  constructor(private lead_id: number) {
    if (lead_id === 0) return;
    console.debug("LEAD LOADED", lead_id);

    // flat check
    const partial_return = new ParialReturn(lead_id);
    const cdek_pickup = new CdekPickup(lead_id);
    const print_pdf = new PrintPdf(lead_id);

    this.timezone();
    this.deleteCompanyField();
    this.validateIndexField();

    this.to_destruct.push(
      () => $("body").off("input"),
      () => partial_return.destructor(),
      () => cdek_pickup.destructor(),
      () => print_pdf.destructor(),
    );
  }

  destructor() {
    console.debug("LEAD DESTRUCTOR", this.lead_id);
    for (const fn of this.to_destruct) {
      fn();
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
      const delivery_type = $('div[data-id="1337998"] > div > div > button').text().trim();
      console.debug("VALIDATE INDEX FIELD", delivery_type);

      if (delivery_type === "Экспресс по России" || delivery_type === "Почта России") {
        const index = CFV(1454436).val();
        if (!index || isNaN(Number(index)) || Number(index) > 999999 || Number(index) < 100000) {
          console.debug("wrong index");
          CFV(1454436).parent().parent().addClass("validation-not-valid");
        } else {
          CFV(1454436).parent().parent().removeClass("validation-not-valid");
        }
      } else {
        CFV(1454436).parent().parent().removeClass("validation-not-valid");
      }
    }
    check();
    CFV(1454436).on("input", check);
    $('button[data-value="3528714"] > span').on("DOMSubtreeModified", check);
    this.to_destruct.push(() => {
      CFV(1454436).off("input");
      $('button[data-value="3528714"] > span').off("DOMSubtreeModified");
    });
  }
}
