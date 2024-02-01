import { promises as fs } from "node:fs";

import { Form } from "./pdf-builder.lib";

export type Post112ep = Partial<{
  sum: string;
  kop: string;
  sum_words: string;
  recipient_phone: string;
  recipient: string;
  recipient_address: string;
  recipient_index: string;
  recipient_inn: string;
  recipient_correspondent_account: string;
  recipient_bank_name: string;
  recipient_cheking_account: string;
  recipient_bik: string;
}>;

export const post112p: Form<Post112ep> = {
  data: fs.readFile("./assets/form112ep.pdf"),
  fileds_map: {
    sum: { font_size: 23, field_name: "Summ" },
    kop: { font_size: 23, field_name: "kop" },
    sum_words: { font_size: 15, field_name: "SummWords" },
    recipient_phone: { font_size: 18, field_name: "SenderPhone" },
    recipient: { font_size: 18, field_name: "Recipient" },
    recipient_address: { font_size: 18, field_name: "RecipientAddress" },
    recipient_index: { font_size: 18, field_name: "RecipientIndex" },
    recipient_inn: { font_size: 18, field_name: "RecipientINN" },
    recipient_correspondent_account: { font_size: 18, field_name: "RecipientCorrespondentAccount" },
    recipient_bank_name: { font_size: 18, field_name: "RecipientBankName" },
    recipient_cheking_account: { font_size: 18, field_name: "RecipientChekingAccount" },
    recipient_bik: { font_size: 18, field_name: "RecipientBIK" },
  },
} as const;
