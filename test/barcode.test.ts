import { expect, test } from "bun:test";
import { code128 } from "../apps/userscripts/amo/barcode";

test("Code128 renders reference B/C symbols, checksum, stop and quiet zones", () => {
  // Each group is an independent Code128 reference symbol, including checksum and stop.
  const cases = [
    ["ABC", "211214 111323 131123 131321 222122 2331112"],
    ["001234", "211232 212222 112232 131123 321122 2331112"],
    ["A12B", "211214 111323 113141 112232 114131 131123 122231 2331112"],
    ["123", "211232 112232 114131 221132 121124 2331112"],
    ["7", "211214 312131 311222 2331112"],
    ["<>&", "211214 322112 212123 122213 121322 2331112"],
  ];

  for (const [sku, reference] of cases) {
    const { path, width } = code128(sku);
    const bars = [...path.matchAll(/M(\d+) 10h(\d+)v70h-(\d+)z /g)];
    expect(bars.map(([command]) => command).join("")).toBe(path);
    expect(Number(bars[0][1])).toBe(20);

    let pattern = "";
    bars.forEach((bar, i) => {
      const x = Number(bar[1]);
      const w = Number(bar[2]);
      expect(bar[2]).toBe(bar[3]);
      pattern += w / 2;
      if (i + 1 < bars.length) pattern += (Number(bars[i + 1][1]) - x - w) / 2;
      else expect(width - x - w).toBe(20);
    });
    expect(pattern).toBe(reference.replaceAll(" ", ""));
  }
});

test("Code128 rejects empty and unsupported input without trimming valid spaces", () => {
  for (const sku of ["", "Артикул", "A\n", "A\t", "\x00", "\x7f", "é", "📊"]) {
    expect(() => code128(sku)).toThrow("ASCII");
  }
  expect(code128(" A ")).not.toEqual(code128("A"));
});
