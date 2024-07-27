import { BACKEND_BASE_URL } from "./common";

export class PrintPdf {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/print_pdf`;

  constructor(private lead_id: number) {
    console.debug("PRINT PDF LOADED", lead_id);

    $("div.card-holder").on("DOMNodeInserted", "div.feed-note-wrapper-note", (el) => {
      const e = $(el.currentTarget).find("div.feed-note__body p");
      if (e) {
        this.handleNote(e);
      }
    });
    $("head").append(
      '<style class="print_pdf" type="text/css">a.download_pdf { cursor: pointer }</style>',
    );

    this.printPdf();
    this.render();
  }

  destructor() {
    console.debug("PRINT PDF DESTRUCTOR", this.lead_id);
    $("div.card-holder").off("DOMNodeInserted");
    $("head").find("style.print_pdf").remove();
  }

  render() {
    $("div.feed-note-wrapper-note").each((i, el) => {
      const e = $(el).find("div.feed-note__body p");
      if (e) {
        this.handleNote(e);
      }
    });
  }

  printPdf() {
    // @ts-expect-error define on function
    if (window.printPdf) return;
    // @ts-expect-error define on function
    window.printPdf = async (public_url: string) => {
      console.debug("PRINT PDF", public_url);
      try {
        const res = await fetch(`${this.BACKEND_URL}?url=${public_url}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => iframe.remove(), 60 * 1000);
      } catch (e) {
        console.error("PRINT PDF ERROR", e);
        alert("Ошибка при печати PDF");
      }
    };
  }

  handleNote(el: JQuery<HTMLElement>) {
    if (el.text().includes("https://yadi.sk/") && !el.text().includes("🖨️")) {
      el.append(
        ` <a target="_blank" rel="nofollow" class="download_pdf" onclick="window.printPdf('${el.find("a").attr("href")}');">🖨️</a>`,
      );
    }
  }
}
