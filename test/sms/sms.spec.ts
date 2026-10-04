import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { spec } from "pactum";

import { type INestApplication } from "@nestjs/common";

import { AmoService } from "../../src/amo/amo.service";
import { DbService } from "../../src/db/db.service";
import { GoogleSheetsService } from "../../src/google-sheets/google-sheets.service";
import { createTestApp } from "../helpers/create-test-app";

type MockedFunction = { mock: { calls: unknown[][] } };

const BASE_URL = `http://localhost:${process.env.PORT ?? 6969}`;
const API_URL = "https://cp.redsms.ru/api/message?fields=uuid,status,to";
const TO = "+79152174503";
const PRICE = 9.15;

let app: INestApplication;
let amo: AmoService;
let db: DbService;
let googleSheets: GoogleSheetsService;
let uuidCounter = 0;

function getCalls(fn: unknown): unknown[][] {
  return (fn as MockedFunction).mock.calls;
}

function notes(): string[] {
  return getCalls(amo.client.note.addNotes).flatMap(([, list]) =>
    (list as { params: { text: string } }[]).map((note) => note.params.text),
  );
}

function nextUuid(): string {
  return `f57edc56-bb7c-11f1-90b5-0242c0a86${(++uuidCounter).toString().padStart(3, "0")}`;
}

function webhookBody(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

function redsmsAccepted(uuid: string, status = "created"): Response {
  return new Response(
    JSON.stringify({ items: [{ uuid, status, to: TO }], errors: [], count: 1, success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function waitCalls(fn: unknown, count: number, timeout = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (getCalls(fn).length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected ${count} calls, got ${getCalls(fn).length}`);
}

async function waitNoCalls(fn: unknown, timeout = 300): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, timeout));
  expect(getCalls(fn)).toHaveLength(0);
}

function expectSpendings(operator: string, statusTime: number) {
  expect(getCalls(db.spendings.addSpendings)[0][0]).toEqual([
    { date: statusTime, description: `СМС ${operator}`, amount: PRICE },
  ]);
  expect(getCalls(googleSheets.spendings.addSpendings)[0][0]).toEqual([
    {
      date: expect.stringMatching(/^\d{2}\.\d{2}\.\d{4}$/),
      description: `СМС ${operator}`,
      amount: PRICE,
    },
  ]);
}

describe("SMS e2e", () => {
  beforeAll(async () => {
    ({ app } = await createTestApp());
    amo = app.get<AmoService>(AmoService);
    db = app.get<DbService>(DbService);
    googleSheets = app.get<GoogleSheetsService>(GoogleSheetsService);
    await app.listen(process.env.PORT ?? 6969);
  });

  beforeEach(() => {
    getCalls(amo.client.note.addNotes).length = 0;
    getCalls(db.spendings.addSpendings).length = 0;
    getCalls(googleSheets.spendings.addSpendings).length = 0;
  });

  afterEach(() => {
    spyOn(globalThis, "fetch").mockRestore();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("send", () => {
    test("signs the request with md5(ts + api key) and returns the uuid", async () => {
      const uuid = nextUuid();
      const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(redsmsAccepted(uuid));

      await spec()
        .post(`${BASE_URL}/web/sms`)
        .withJson({ lead_id: 1234, phone: "8 (915) 217-45-03", text: "Меховой салон GERDA" })
        .expectStatus(201)
        .expectJson({ uuid });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(API_URL);

      const headers = init.headers as Record<string, string>;
      expect(headers["login"]).toBeTruthy();
      expect(headers["ts"]).toBeTruthy();
      expect(headers["secret"]).toMatch(/^[0-9a-f]{32}$/);
      expect(JSON.parse(init.body as string)).toEqual({
        route: "sms",
        from: expect.any(String),
        to: TO,
        text: "Меховой салон GERDA",
      });
      expect(JSON.parse(init.body as string).from).toBeTruthy();
    });

    test("rejects invalid data without calling RED SMS", async () => {
      const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(redsmsAccepted(nextUuid()));

      for (const body of [
        { lead_id: 1234, phone: "нет номера", text: "text" },
        { lead_id: 1234, phone: TO, text: "   " },
        { lead_id: 0, phone: TO, text: "text" },
      ]) {
        await spec().post(`${BASE_URL}/web/sms`).withJson(body).expectStatus(400);
      }

      expect(fetchMock).toHaveBeenCalledTimes(0);
      expect(notes()).toHaveLength(0);
    });

    test("returns 500 when RED SMS rejects the request", async () => {
      spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 401 }));

      await spec()
        .post(`${BASE_URL}/web/sms`)
        .withJson({ lead_id: 1234, phone: TO, text: "Меховой салон GERDA" })
        .expectStatus(500);

      await waitNoCalls(amo.client.note.addNotes);
      expect(notes()).toHaveLength(0);
    });

    test("returns 500 when RED SMS answers without a uuid", async () => {
      spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ success: false, errors: [{ to: TO, message: "bad number" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await spec()
        .post(`${BASE_URL}/web/sms`)
        .withJson({ lead_id: 1234, phone: TO, text: "Меховой салон GERDA" })
        .expectStatus(500);

      await waitNoCalls(amo.client.note.addNotes);
      expect(notes()).toHaveLength(0);
    });
  });

  describe("webhook", () => {
    async function send(uuid: string) {
      spyOn(globalThis, "fetch").mockResolvedValue(redsmsAccepted(uuid));
      await spec()
        .post(`${BASE_URL}/web/sms`)
        .withJson({ lead_id: 1234, phone: TO, text: "Меховой салон GERDA" })
        .expectStatus(201);
      spyOn(globalThis, "fetch").mockRestore();
    }

    function webhook(params: Record<string, string | number>) {
      return spec()
        .post(`${BASE_URL}/sms/webhook`)
        .withHeaders({
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "REDSMS API CALLBACK",
        })
        .withBody(webhookBody(params));
    }

    test("writes the delivery note with the operator and the delivery time", async () => {
      const uuid = nextUuid();
      const status_time = Math.round(Date.now() / 1000) + 5;
      await send(uuid);

      await webhook({
        uuid,
        status: "delivered",
        status_time,
        errCode: 0,
        to: TO,
        from: "GERDA",
        operator: "МТС",
        pool_operator_name: '"Мобильные Телесистемы" ПАО',
        price: PRICE,
      })
        .expectStatus(200)
        .expectBody("OK");

      await waitCalls(amo.client.note.addNotes, 1);
      expect(notes()[0]).toMatch(/^✅ SMS: доставлено оператором МТС \(\d+с\)$/);
      expect(getCalls(amo.client.note.addNotes)[0][0]).toBe("leads");
      expect((getCalls(amo.client.note.addNotes)[0][1] as { entity_id: number }[])[0].entity_id).toBe(1234);

      await waitCalls(googleSheets.spendings.addSpendings, 1);
      expectSpendings("МТС", status_time);
    });

    test("writes the error note with the decoded status", async () => {
      const uuid = nextUuid();
      await send(uuid);

      await webhook({
        uuid,
        status: "undelivered",
        status_time: Math.round(Date.now() / 1000) + 3,
        errCode: 42,
        to: TO,
        operator: "Ростелеком",
        price: PRICE,
      }).expectStatus(200);

      await waitCalls(amo.client.note.addNotes, 1);
      expect(notes()[0]).toMatch(
        /^❌ SMS: сообщение не доставлено \(undelivered\), код 42 оператором Ростелеком \(\d+с\)$/,
      );

      await waitCalls(googleSheets.spendings.addSpendings, 1);
      expect(getCalls(db.spendings.addSpendings)[0][0]).toEqual([
        {
          date: expect.any(Number),
          description: "СМС Ростелеком",
          amount: PRICE,
        },
      ]);
    });

    test("writes the error note without errCode for status only failures", async () => {
      const uuid = nextUuid();
      await send(uuid);

      await webhook({
        uuid,
        status: "no_money",
        status_time: Math.round(Date.now() / 1000) + 1,
        errCode: 0,
      }).expectStatus(200);

      await waitCalls(amo.client.note.addNotes, 1);
      expect(notes()[0]).toMatch(
        /^❌ SMS: недостаточно средств для отправки сообщения \(no_money\) \(\d+с\)$/,
      );

      await waitCalls(googleSheets.spendings.addSpendings, 1);
      expect(getCalls(db.spendings.addSpendings)[0][0]).toEqual([
        { date: expect.any(Number), description: "СМС", amount: 0 },
      ]);
    });

    test("ignores intermediate statuses", async () => {
      const uuid = nextUuid();
      await send(uuid);

      for (const status of ["created", "progress"]) {
        await webhook({ uuid, status, status_time: Math.round(Date.now() / 1000) }).expectStatus(200);
      }

      await waitNoCalls(amo.client.note.addNotes);
      expect(notes()).toHaveLength(0);
      expect(getCalls(db.spendings.addSpendings)).toHaveLength(0);
      expect(getCalls(googleSheets.spendings.addSpendings)).toHaveLength(0);
    });

    test("ignores unknown uuid", async () => {
      await webhook({ uuid: nextUuid(), status: "delivered" })
        .expectStatus(200)
        .expectBody("OK");

      await waitNoCalls(amo.client.note.addNotes);
      expect(notes()).toHaveLength(0);
      expect(getCalls(db.spendings.addSpendings)).toHaveLength(0);
    });

    test("does not duplicate the note and the spending for a repeated delivered status", async () => {
      const uuid = nextUuid();
      await send(uuid);

      const delivered = {
        uuid,
        status: "delivered",
        status_time: Math.round(Date.now() / 1000) + 5,
        operator: "Билайн",
        price: PRICE,
      };

      await webhook(delivered).expectStatus(200);
      await waitCalls(amo.client.note.addNotes, 1);
      await waitCalls(googleSheets.spendings.addSpendings, 1);

      await webhook(delivered).expectStatus(200);
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(notes()).toHaveLength(1);
      expect(getCalls(db.spendings.addSpendings)).toHaveLength(1);
      expect(getCalls(googleSheets.spendings.addSpendings)).toHaveLength(1);
    });
  });
});
