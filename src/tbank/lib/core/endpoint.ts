import type { Client } from "./client";

export class Endpoint {
  constructor(protected client: Client) {}
}
