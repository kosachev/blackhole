import { passthrough, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const mock_server = setupServer(
  // do not mock tested api urls
  http.all(`http://localhost:${process.env.PORT ?? 6969}/*`, () => passthrough()),

  // TODO: example, delete later
  http.get("https://google.com", () => {
    return HttpResponse.json({ message: "HEY" });
  }),
);
