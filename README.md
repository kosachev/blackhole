# Gerda

Backend service for automating e-commerce processes. The primary goal is to integrate AmoCRM with various logistics, payment, and communication services.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Framework:** [Nest.JS](https://nestjs.com/) (v11+)
- **Language:** TypeScript
- **Linter:** [Oxlint](https://github.com/oxc-project/oxlint)

## Key Integrations

- **CRM:** AmoCRM (widgets and scripts)
- **Logistics:** CDEK, Russian Post
- **Payments:** T-Bank (formerly Tinkoff)
- **Communication:** Telegram (GrammY)
- **Services:** Yandex Disk, Yandex Metrika, Google Sheets, Tilda
- **Documents:** PDF generation (pdf-lib, handlebars)

## Project Structure

- `src/` — core application logic and integration modules.
- `apps/userscripts/` — client-side scripts for AmoCRM.
- `scripts/` — build and monitoring utilities.
- `test/` — E2E and integration tests.

## Getting Started

The project uses `bun` as the primary package manager and runtime.

### Installation

```bash
bun install
```

### Development

```bash
bun run start:debug
```

### Production

```bash
bun run start:prod
```

### Useful Commands

- `bun run lint` — fast code checking via oxlint.
- `bun run test:all` — run all tests.
- `bun run build:client` — build client-side scripts.
- `bun run tail` — view real-time logs.

## Features

- **No-env-file:** The `start` command is configured with the `--no-env-file` flag; Nest.JS handles loading environment variables from `.env.prod` or `.env.dev`.
- **Binary Compilation:** Scripts are available to compile the application into a standalone executable for Windows and Linux (`build:app:*`).
