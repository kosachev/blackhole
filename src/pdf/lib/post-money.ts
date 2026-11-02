import { convert } from "number-to-words-ru";

export function postMoney(amount: number) {
  const cents = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isFinite(amount) || amount < 0 || cents > 99_999_999) {
    throw new Error("Сумма почтового перевода должна быть от 0 до 999999,99 руб.");
  }
  return {
    sum: Math.floor(cents / 100).toString(),
    kop: (cents % 100).toString().padStart(2, "0"),
    sum_words: convert(cents / 100).toLocaleLowerCase(),
  };
}
