import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  const rows = [
    { name: 'Toko "Maju", Jaya', value: 1_400_000 as number | null, note: "baris1\nbaris2" },
    { name: "=HYPERLINK(1)", value: null, note: "" },
  ];
  const csv = toCsv(rows, [
    { header: "Nama", value: (r) => r.name },
    { header: "Nilai", value: (r) => r.value },
    { header: "Catatan", value: (r) => r.note },
  ]);
  it("BOM, header, dan CRLF", () => {
    expect(csv.startsWith("﻿Nama,Nilai,Catatan\r\n")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("meng-escape koma, kutip, dan baris baru; angka polos", () => {
    expect(csv).toContain('"Toko ""Maju"", Jaya",1400000,"baris1\nbaris2"\r\n');
  });
  it("menetralkan formula dan mengosongkan null", () => {
    expect(csv).toContain("'=HYPERLINK(1),,\r\n");
  });
});
