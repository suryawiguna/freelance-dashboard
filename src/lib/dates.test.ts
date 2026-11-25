import { describe, expect, it } from "vitest";
import { addDays, daysBetween, dueStatus, formatDate, isDateStr, monthOf, relativeLabel, todayWita } from "./dates";

describe("todayWita", () => {
  it("memakai UTC+8, bukan zona perangkat", () => {
    // 16:30 UTC = 00:30 WITA hari berikutnya.
    expect(todayWita(new Date("2026-11-25T16:30:00Z"))).toBe("2026-11-26");
    expect(todayWita(new Date("2026-11-25T15:59:00Z"))).toBe("2026-11-25");
  });
});

describe("isDateStr", () => {
  it("hanya YYYY-MM-DD yang ada di kalender", () => {
    expect(isDateStr("2026-11-27")).toBe(true);
    expect(isDateStr("2028-02-29")).toBe(true);
    expect(isDateStr("2026-02-29")).toBe(false);
    expect(isDateStr("2026-13-01")).toBe(false);
    expect(isDateStr("27-11-2026")).toBe(false);
    expect(isDateStr("")).toBe(false);
  });
});

describe("daysBetween dan addDays", () => {
  it("menghitung selisih hari", () => {
    expect(daysBetween("2026-11-25", "2026-11-27")).toBe(2);
    expect(daysBetween("2026-11-27", "2026-11-25")).toBe(-2);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
  it("menambah hari melewati bulan dan tahun", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("menolak tanggal tidak valid", () => {
    expect(() => daysBetween("", "2026-11-25")).toThrow();
  });
});

describe("formatDate", () => {
  it("format pendek Indonesia", () => {
    expect(formatDate("2026-11-27")).toBe("27 Nov 2026");
    expect(formatDate("2026-05-01")).toBe("1 Mei 2026");
    expect(formatDate("2026-08-17")).toBe("17 Agu 2026");
    expect(formatDate("")).toBe("");
  });
  it("monthOf", () => {
    expect(monthOf("2026-11-27")).toBe("2026-11");
  });
});


describe("relativeLabel", () => {
  it("teks status tanpa mengandalkan warna", () => {
    expect(relativeLabel(-2)).toBe("Lewat 2 hari");
    expect(relativeLabel(0)).toBe("Hari ini");
    expect(relativeLabel(1)).toBe("Besok");
    expect(relativeLabel(5)).toBe("5 hari lagi");
  });
});

describe("dueStatus", () => {
  it("lewat, dekat, atau tidak ada status", () => {
    expect(dueStatus("2026-11-24", "2026-11-25", 3)).toEqual({ tone: "late", label: "Lewat 1 hari" });
    expect(dueStatus("2026-11-28", "2026-11-25", 3)).toEqual({ tone: "near", label: "3 hari lagi" });
    expect(dueStatus("2026-11-29", "2026-11-25", 3)).toBeNull();
    expect(dueStatus("", "2026-11-25", 3)).toBeNull();
  });
});
