# GERDA DB UI

Read-only reports for backend data. The first section is manager KPI.

## Local HTTP development

Run `bun run build:client`, then `bun run start:dev` and open
`http://127.0.0.1:6969/public/db-ui.html`.

This starts only the database and report/static controllers, binds to loopback,
uses HTTP even if NODE_ENV is production, and reads only `.env.dev` (plus process
environment). It does not load `.env.prod`, external integrations or scheduled jobs.
No SSL or external API keys are needed. DB UI authentication still requires the
password hash and signing secret described below.
The database defaults to `./data/gerda.db`. To choose a local database or port,
pass process variables, e.g. `DB_PATH=./data/local.db PORT=6970 bun run start:dev`.
A missing database is initialized with the normal schema and has no report rows.

`bun start` still starts the full backend and requires its integration credentials.

## Build and routes

Run `bun run build:client`, then start the backend normally. The existing build
script bundles `main.ts` with Bun and embeds the JavaScript and `style.css` in
`index.html`, producing `public/db-ui.html`. Generated HTML is ignored by Git.
Build the client before starting or compiling the backend, as with userscripts.

- Page: `/public/db-ui.html`
- Data: `GET /web/db_ui/kpi`

The page calls the API on the same origin. It does not use the userscripts'
`--backend` setting or depend on amoCRM browser globals. The HTML/login form is public; the data API requires authentication.

The API delegates through `DbUiService` to `DbService.kpi.getKpi()` and returns
all stored KPI rows, ordered by time and row ID descending. It only reads data;
no report settings, rates, names or calculated amounts are written to the server.

## Authentication

Set these values in `.env.dev` for local mode, or in the full backend environment:

```dotenv
DB_UI_PASSWORD_HASH='<Bun.password hash>'
DB_UI_TOKEN_SECRET='<random secret, at least 32 bytes>'
```

Keep the hash in single quotes so its `$` characters are preserved. Generate it
without putting the password into shell history (Python prompts with hidden input):

```sh
python3 -c 'import getpass, sys; sys.stdout.write(getpass.getpass("Password: "))' | bun --no-env-file -e 'console.log(await Bun.password.hash(await Bun.stdin.text()))'
bun --no-env-file -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

The first command prints the password hash; the second prints the signing secret.
Do not commit these generated values. Restart after changing configuration.

`POST /web/db_ui/login` accepts JSON `{ "password": "..." }`, verifies it using
`Bun.password.verify`, and returns `{ "token": "..." }`. The client saves only the
token in localStorage and sends it as `Authorization: Bearer <token>`.

Tokens are randomly generated and signed with HMAC-SHA256. They have no expiry
and survive server restarts. No session table or database writes are needed.
Changing either the signing secret or the password hash invalidates all tokens.
Logout removes the token from this browser; it does not revoke copies elsewhere.
A 401 response clears the local session and shows the login form again.

Missing configuration denies access (503); it never disables authentication.
Login is limited to five attempts per minute per direct client IP in each server
process. Authorization headers and DB UI request/response bodies are redacted
from HTTP logs. All report endpoints in `DbUiController` inherit its auth guard.

## Report rules

- Filtering, aggregation, pagination and CSV generation run in the browser.
- Dates include both selected days in Moscow time (UTC+03:00), using
  `kpi_reached_at`. Rows without this timestamp are excluded with a visible count.
- The recipient is `responsible_user`. Known legacy aliases (`Manager-1`, etc.)
  and numeric user IDs resolve to the same manager.
- Initial rates: visit = 100 RUB, payment = 200 RUB, delivery = 100 RUB.
- `price` is the deal amount, not the KPI amount. Calculations use integer kopecks.
- Each stored row counts separately, including repeated deal/stage combinations.
- Unconfigured stages remain visible as “Без ставки”, and do not contribute
  to the total until a rate is provided. A zero rate is a configured rate.
- Manager names, stage names and rates are saved in localStorage under
  `gerda.db-ui.settings.v1`. Settings are specific to this browser and origin.
- Changed rates apply to every row in the selected period, including past dates.
  Historical rate schedules are not implemented.
- CSV uses the applied report filters and the complete filtered snapshot, not
  just the visible page. It uses UTF-8 BOM, semicolons, decimal commas, quoted
  cells and protection against spreadsheet formulas in text fields.
- The UI loads a full snapshot on open or “Обновить данные”. This deliberately
  keeps the initial API simple; larger datasets may require paged retrieval later.

## Extension and validation

Keep future report-specific calculations in separate modules alongside `kpi.ts`.
Add typed getters to the corresponding table facade and explicit read routes to
a report controller; do not expose arbitrary SQL or table names from the browser.

Run `bun run build:client` followed by
`bun test --no-env-file ./test/db ./test/db-ui ./test/web` for focused checks.
The normal `test:all` and `test:cov` scripts also include these tests.
