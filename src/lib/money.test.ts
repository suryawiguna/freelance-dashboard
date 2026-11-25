import { describe, expect, it } from "vitest";
import { formatRupiah, formatRupiahOrEmpty, parseRupiah } from "./money";

describe("formatRupiah", () => {
  it("memakai titik ribuan tanpa spasi", () => {
    expect(formatRupiah(1_400_000)).toBe("Rp1.400.000");
    expect(formatRupiah(145_000)).toBe("Rp145.000");
    expect(formatRupiah(0)).toBe("Rp0");
  });
  it("menandai minus di depan", () => {
    expect(formatRupiah(-5000)).toBe("-Rp5.000");
  });
  it("null jadi kosong", () => {
    expect(formatRupiahOrEmpty(null)).toBe("");
    expect(formatRupiahOrEmpty(290_000)).toBe("Rp290.000");
  });
});

describe("parseRupiah", () => {
  it("menerima format umum", () => {
    expect(parseRupiah("1.400.000")).toBe(1_400_000);
    expect(parseRupiah("Rp1.400.000")).toBe(1_400_000);
    expect(parseRupiah("rp 145.000")).toBe(145_000);
    expect(parseRupiah("1400000")).toBe(1_400_000);
    expect(parseRupiah(" 1 400 000 ")).toBe(1_400_000);
  });
  it("kosong = null", () => {
    expect(parseRupiah("")).toBeNull();
    expect(parseRupiah("   ")).toBeNull();
  });
  it("menolak desimal, minus, dan huruf", () => {
    expect(parseRupiah("1,5")).toBeUndefined();
    expect(parseRupiah("-5000")).toBeUndefined();
    expect(parseRupiah("satu juta")).toBeUndefined();
    expect(parseRupiah("99999999999999999999")).toBeUndefined();
  });
});
