import type { Database } from "bun:sqlite";

export class CdekPriceTable {
  constructor(private readonly database: Database) {}

  getCdekDelta(): number | undefined {
    const row = this.database.query<{ delta: number }, []>("SELECT delta FROM cdek_price WHERE id = 1").get();
    return row?.delta;
  }

  setCdekDelta(delta: number): void {
    this.database
      .query<unknown, [number]>(
        `INSERT INTO cdek_price (id, delta) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET delta = excluded.delta`,
      )
      .run(delta);
  }
}
