/**
 * Logika kalender untuk DatePicker. Murni, dites. Minggu dimulai Senin
 * (kebiasaan Indonesia). Grid selalu 6 minggu supaya tinggi popover tidak
 * berubah saat berpindah bulan.
 */
import type { DateStr } from "../domain/types";

export const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;
export const MONTHS_LONG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export interface YearMonth {
  year: number;
  /** 1 sampai 12. */
  month: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toStr = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function ymOf(date: DateStr): YearMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/** Geser tanggal sejumlah bulan; tanggal 31 jadi akhir bulan bila perlu. */
export function addMonths(date: DateStr, delta: number): DateStr {
  const { year, month } = shiftMonth(ymOf(date), delta);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(Number(date.slice(8, 10)), last))}`;
}

/** 0 = Senin ... 6 = Minggu. */
export function weekdayIndex(date: DateStr): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export interface DayCell {
  date: DateStr;
  day: number;
  inMonth: boolean;
}

/** 42 sel (6 minggu x 7 hari), termasuk hari dari bulan sebelum dan sesudahnya. */
export function monthGrid({ year, month }: YearMonth): DayCell[] {
  const first = `${year}-${pad(month)}-01`;
  const start = new Date(Date.UTC(year, month - 1, 1 - weekdayIndex(first)));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    return { date: toStr(d), day: d.getUTCDate(), inMonth: d.getUTCMonth() === month - 1 };
  });
}

export const monthTitle = ({ year, month }: YearMonth) => `${MONTHS_LONG[month - 1]} ${year}`;

/** "27 November 2026", untuk aria-label tombol hari. */
export function longDate(date: DateStr): string {
  const { year, month } = ymOf(date);
  return `${Number(date.slice(8, 10))} ${MONTHS_LONG[month - 1]} ${year}`;
}
