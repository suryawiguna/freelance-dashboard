/**
 * Tanggal bisnis = tanggal lokal WITA (Asia/Makassar, UTC+8, tanpa DST),
 * disimpan sebagai "YYYY-MM-DD". Semua hitungan memakai string itu, bukan
 * Date lokal perangkat, supaya laptop dengan zona waktu lain tetap benar.
 */
import type { DateStr } from "../domain/types";

export const TIME_ZONE = "Asia/Makassar";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAY_MS = 86_400_000;

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Tanggal hari ini di WITA. */
export function todayWita(now: Date = new Date()): DateStr {
  return ymd.format(now);
}

/** True bila string berbentuk YYYY-MM-DD dan tanggalnya ada di kalender. */
export function isDateStr(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function toUtcMs(s: DateStr): number {
  if (!isDateStr(s)) throw new Error(`Tanggal tidak valid: "${s}"`);
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Selisih hari b - a. daysBetween("2026-11-25", "2026-11-27") = 2. */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

export function addDays(s: DateStr, days: number): DateStr {
  return new Date(toUtcMs(s) + days * DAY_MS).toISOString().slice(0, 10);
}

/** "2026-11-27" jadi "27 Nov 2026". "" tetap "". */
export function formatDate(s: DateStr): string {
  if (s === "") return "";
  toUtcMs(s);
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "YYYY-MM" dari tanggal, untuk mencocokkan bulan berjalan. */
export function monthOf(s: DateStr): string {
  return s.slice(0, 7);
}

/** Label jarak hari untuk status: "Lewat 2 hari", "Hari ini", "Besok", "3 hari lagi". */
export function relativeLabel(days: number): string {
  if (days < 0) return `Lewat ${-days} hari`;
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok";
  return `${days} hari lagi`;
}

/**
 * Status tanggal untuk daftar: "late" bila sudah lewat, "near" bila dalam
 * `nearDays` hari ke depan, selain itu null (cukup tampilkan tanggalnya).
 */
export function dueStatus(
  date: DateStr,
  today: DateStr,
  nearDays: number,
): { tone: "late" | "near"; label: string } | null {
  if (!isDateStr(date)) return null;
  const days = daysBetween(today, date);
  if (days < 0) return { tone: "late", label: relativeLabel(days) };
  if (days <= nearDays) return { tone: "near", label: relativeLabel(days) };
  return null;
}
