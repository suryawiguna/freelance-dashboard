import { describe, expect, it } from "vitest";
import { addMonths, longDate, monthGrid, monthTitle, shiftMonth, weekdayIndex } from "./calendar";
import { placePopover } from "./position";

describe("kalender", () => {
  it("Senin = 0, Minggu = 6", () => {
    expect(weekdayIndex("2026-11-23")).toBe(0); // Senin
    expect(weekdayIndex("2026-11-29")).toBe(6); // Minggu
  });

  it("grid November 2026: 42 sel, mulai Senin 26 Okt", () => {
    const g = monthGrid({ year: 2026, month: 11 });
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ date: "2026-10-26", day: 26, inMonth: false });
    expect(g.find((c) => c.date === "2026-11-01")).toMatchObject({ inMonth: true });
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
    expect(g[41].date).toBe("2026-12-06");
  });

  it("bulan yang dimulai hari Senin tetap 6 minggu", () => {
    const g = monthGrid({ year: 2027, month: 2 }); // 1 Feb 2027 = Senin
    expect(g[0].date).toBe("2027-02-01");
    expect(g).toHaveLength(42);
  });

  it("geser bulan melewati tahun", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-15", -1)).toBe("2026-02-15");
  });

  it("judul dan label panjang", () => {
    expect(monthTitle({ year: 2026, month: 11 })).toBe("November 2026");
    expect(longDate("2026-08-07")).toBe("7 Agustus 2026");
  });
});

describe("placePopover", () => {
  const vp = { width: 375, height: 800 };
  const anchor = { top: 100, bottom: 144, left: 20, width: 335 };

  it("ke bawah bila muat", () => {
    expect(placePopover(anchor, { width: 335, height: 300 }, vp)).toEqual({
      top: 150,
      left: 20,
      maxHeight: 642,
      side: "bottom",
    });
  });

  it("ke atas bila di bawah sempit dan di atas lebih lega", () => {
    const low = { top: 600, bottom: 644, left: 20, width: 335 };
    const p = placePopover(low, { width: 335, height: 400 }, vp);
    expect(p.side).toBe("top");
    expect(p.top).toBe(600 - 6 - 400);
  });

  it("tidak keluar dari sisi kanan layar", () => {
    const right = { top: 100, bottom: 144, left: 300, width: 60 };
    expect(placePopover(right, { width: 340, height: 300 }, vp).left).toBe(375 - 340 - 8);
  });
});
