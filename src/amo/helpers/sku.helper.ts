import { createHash } from "node:crypto";

export function generateSku(name: string, length = 12): string {
  return createHash("sha256")
    .update(name)
    .digest("hex")
    .split("")
    .map((char) => char.charCodeAt(0))
    .join("")
    .slice(0, length);
}
