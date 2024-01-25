import { passthrough, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const mock_server = setupServer(
  // do not mock tested api urls
  http.all(`http://localhost:${process.env.PORT ?? 6969}/*`, () => passthrough()),

  http.all(`https://${process.env.AMO_DOMAIN}/*`, () => {
    return HttpResponse.json({ result: "OK" });
  }),
);
