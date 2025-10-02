import { BACKEND_BASE_URL, card, CFV } from "./common";
import { AMO } from "../src/amo/amo.constants";

type RequestData = {
  leadId: number;
  userName: string;
  userId: number;
  dateCreate: number;
  channel: string;
  source?: string;
  ym_client_id?: string;
};

const userSourcePattern =
  // oxlint-disable-next-line no-useless-escape
  /Обращение\s+с\s+сайта\s+(?<site>[^,]+?)(?:[,\.\s]*клиент[:\s-]*(?<client>\d+))?\s*$/u;

export class FirstLeadInteraction {
  readonly BACKEND_URL = `${BACKEND_BASE_URL}/web/first_lead_interaction`;

  constructor(private lead_id: number) {
    console.debug("FIRST LEAD INTERACTION LOADED", lead_id);

    this.check();
  }

  destructor() {
    console.debug("FIRST LEAD INTERACTION DESTRUCTOR", this.lead_id);
  }

  check() {
    const fti = CFV(AMO.CUSTOM_FIELD.FIRST_TIME_INTERACTION).val().toString() ?? "";
    if (fti !== "") return;

    const dateCreate =
      Math.floor(
        card().notes.notes.models.filter(
          (item) => item.attributes.type === 1 && item.attributes.object_type.code === "event",
        )[0]?.attributes?.date_create,
      ) * 1000;
    console.debug("FIRST LEAD INTERACTION date create", dateCreate, "fti", fti);

    if (isNaN(dateCreate)) return;
    if (card().user.id == AMO.USER.ADMIN) {
      console.debug("FIRST LEAD INTERACTION, ADMIN USER, SKIP ");
      return;
    }

    const userSourceMessage = Array.from(
      document.querySelectorAll(".feed-note__message_paragraph").values(),
    )
      .find((item) => item.textContent?.match(userSourcePattern) !== null)
      ?.textContent.match(userSourcePattern);

    const data = {
      leadId: this.lead_id,
      userName: card().user.name,
      userId: card().user.id,
      dateCreate,
      channel: "whatsapp",
      source: userSourceMessage?.groups?.site,
      ym_client_id: userSourceMessage?.groups?.client,
    } satisfies RequestData;

    this.sendRequest(data);
  }

  async sendRequest(data: RequestData) {
    console.debug("SEND DATA FIRST LEAD INTERACTION", data);

    try {
      const res = await fetch(this.BACKEND_URL, {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw Error("FIRST LEAD INTERACTION ERROR, failed send data to backend");
      }
    } catch (err) {
      console.error("FIRST LEAD INTERACTION ERROR", err);
    }
  }
}
