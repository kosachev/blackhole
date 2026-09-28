import type { Database } from "bun:sqlite";

export class SpendingsTable {
  constructor(private readonly database: Database) {}

  addSpendings(spendings: SpendingsEntry[]): SpendingsAddResult {
    if (spendings.length === 0) {
      return { addedRows: 0 };
    }

    const insert = this.database.prepare(`
      INSERT INTO spendings (date, description, amount)
      VALUES (?, ?, ?)
    `);

    return {
      addedRows: this.database
        .transaction(() => {
          for (const spending of spendings) {
            insert.run(spending.date ?? null, spending.description ?? "", spending.amount ?? null);
          }

          return spendings.length;
        })
        .immediate(),
    };
  }
}

export type SpendingsEntry = Partial<{
  date: number;
  description: string;
  amount: number;
}>;

export type SpendingsAddResult = { addedRows: number };
