import { promises as fs } from "node:fs";

import { type Form } from "./pdf-builder.lib";

import form7p from "../../../assets/form7p.pdf" with { type: "file" };

export type Post7p = Partial<{
  sender: string;
  sender_address: string;
  sender_address2: string;
  sender_address3: string;
  sender_index: string;
  sender_phone: string;
  sum_insured: string;
  sum_cash_on_delivery: string;
  recipient: string;
  recipient_address: string;
  recipient_address2: string;
  recipient_address3: string;
  recipient_phone: string;
  recipient_index: string;
}>;

export const post7p: Form<Post7p> = {
  data: fs.readFile(form7p),
  fileds_map: {
    sender: {
      font_size: 11,
      field_name:
        "Sender_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    sender_address: {
      font_size: 10,
      field_name:
        "SenderAddress_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    sender_address2: {
      font_size: 10,
      field_name:
        "SenderAddress_2_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    sender_address3: {
      font_size: 10,
      field_name:
        "SenderAddress_3_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    sender_index: {
      font_size: 17,
      field_name:
        "SenderIndex_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    sender_phone: {
      font_size: 12,
      field_name:
        "SenderPhone_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    sum_insured: {
      font_size: 8,
      field_name:
        "SummInsured_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    sum_cash_on_delivery: {
      font_size: 8,
      field_name:
        "SummCashOnDelivery_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    recipient: {
      font_size: 11,
      field_name:
        "Recipient_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    recipient_address: {
      font_size: 10,
      field_name:
        "RecipientAddress_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    recipient_address2: {
      font_size: 10,
      field_name:
        "RecipientAddress_2_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    recipient_address3: {
      font_size: 10,
      field_name:
        "RecipientAddress_3_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    recipient_phone: {
      font_size: 12,
      field_name:
        "RecipientPhone_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
    recipient_index: {
      font_size: 17,
      field_name:
        "RecipientIndex_b7419eee-03de-4ce1-9153-fc0349f08bd5_49e77628-1248-4600-9019-5c81cc1d413d",
    },
  },
} as const;
