export function wordWrap(text: string, limit: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if (cur.length + word.length + 1 < limit) {
      if (cur !== "") cur += " ";
      cur += word;
      continue;
    }
    out.push(cur);
    cur = word;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}
