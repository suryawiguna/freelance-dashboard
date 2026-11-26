/**
 * Validasi form, cermin dari firestore.rules. Rules tetap penjaga terakhir;
 * ini supaya pesan salah muncul di field, bukan sebagai "permission denied".
 * Rules tidak bisa memeriksa isi tiap elemen daftar (log, extras), jadi
 * elemen hanya divalidasi di sini.
 */
import { isDateStr } from "../lib/dates";
import type { CollectionName, Draft, Records } from "./records";
import {
  ASSET_KINDS,
  LIMITS,
  NEXT_REQUIRED_STAGES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  SOURCES,
  STAGES,
} from "./types";

export type Errors = Record<string, string>;

const MAX_MONEY = 100_000_000_000;

const isHttpsOrEmpty = (s: string) => s === "" || /^https:\/\/[^ ]+$/.test(s);
/** Sama dengan contactOrEmpty() di firestore.rules. */
export const isContact = (s: string) => isHttpsOrEmpty(s) || (s.length <= 320 && /^mailto:[^ @/]+@[^ @/]+\.[^ @/]+$/.test(s));
/** Sama dengan phoneOrEmpty() di firestore.rules. */
export const isPhone = (s: string) => s.length <= 30 && /^[0-9+ ()-]*$/.test(s);
export const isMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const dateOk = (s: string) => s === "" || isDateStr(s);
const moneyOk = (v: number | null) => v === null || (Number.isInteger(v) && v >= 0 && v <= MAX_MONEY);

function text(errors: Errors, key: string, v: string, max: number, required = false) {
  if (required && v.trim() === "") errors[key] = "Wajib diisi.";
  else if (v.length > max) errors[key] = `Maksimal ${max} karakter.`;
}

export function validate<C extends CollectionName>(c: C, d: Draft<Records[C]>): Errors {
  const e: Errors = {};
  const url = (key: string, v: string) => {
    if (!isHttpsOrEmpty(v)) e[key] = "Harus link lengkap yang diawali https://";
  };
  const date = (key: string, v: string) => {
    if (!dateOk(v)) e[key] = "Tanggal tidak valid.";
  };
  const money = (key: string, v: number | null) => {
    if (!moneyOk(v)) e[key] = "Angka rupiah tidak valid.";
  };
  const oneOf = (key: string, v: string, list: readonly string[]) => {
    if (!list.includes(v)) e[key] = "Pilih salah satu.";
  };
  const ref = (key: string, v: string | null, required: boolean) => {
    if (v === null || v === "") {
      if (required) e[key] = "Wajib dipilih.";
    } else if (v.length > 200) e[key] = "Pilihan tidak valid.";
  };

  switch (c) {
    case "services": {
      const s = d as Draft<Records["services"]>;
      text(e, "name", s.name, 200, true);
      money("setup", s.setup);
      text(e, "setupNote", s.setupNote, 200);
      money("monthly", s.monthly);
      text(e, "unit", s.unit, 50);
      if (!(Number.isInteger(s.dpPercent) && s.dpPercent >= 0 && s.dpPercent <= 100)) e.dpPercent = "Isi 0 sampai 100.";
      if (s.extras.length > LIMITS.extras) e.extras = `Maksimal ${LIMITS.extras} tambahan.`;
      else if (s.extras.some((x) => x.name.trim() === "" || x.name.length > 100 || !moneyOk(x.price))) {
        e.extras = "Setiap baris: nama, titik dua, harga. Contoh: Booking via WhatsApp: 300.000";
      }
      text(e, "includes", s.includes, 5000);
      break;
    }
    case "clients": {
      const k = d as Draft<Records["clients"]>;
      text(e, "name", k.name, 200, true);
      if (!isContact(k.contact)) e.contact = "Isi link lengkap (https://...) atau alamat email.";
      if (!isPhone(k.phone)) e.phone = "Tulis nomor saja, contoh 0812 3456 7890.";
      if (k.source !== "") oneOf("source", k.source, SOURCES);
      text(e, "sourceNote", k.sourceNote, 200);
      text(e, "note", k.note, 5000);
      if (k.log.length > LIMITS.log) e.log = `Maksimal ${LIMITS.log} catatan.`;
      break;
    }
    case "projects": {
      const p = d as Draft<Records["projects"]>;
      ref("clientId", p.clientId, true);
      ref("serviceId", p.serviceId, false);
      text(e, "name", p.name, 200);
      oneOf("stage", p.stage, STAGES);
      money("price", p.price);
      if (p.extras.length > LIMITS.extras) e.extras = `Maksimal ${LIMITS.extras} tambahan.`;
      if (p.qty !== null && !(Number.isInteger(p.qty) && p.qty >= 1 && p.qty <= 1000)) e.qty = "Isi 1 sampai 1000.";
      money("monthly", p.monthly);
      text(e, "next", p.next, 1000);
      date("nextDate", p.nextDate);
      if (!e.nextDate && p.nextDate === "" && NEXT_REQUIRED_STAGES.includes(p.stage)) {
        e.nextDate = "Wajib diisi selama proyek belum Live, Selesai, atau Batal.";
      }
      date("due", p.due);
      url("link", p.link);
      date("dealAt", p.dealAt);
      date("liveAt", p.liveAt);
      text(e, "note", p.note, 5000);
      break;
    }
    case "payments": {
      const p = d as Draft<Records["payments"]>;
      ref("clientId", p.clientId, true);
      ref("projectId", p.projectId, false);
      oneOf("type", p.type, PAYMENT_TYPES);
      text(e, "item", p.item, 200);
      if (p.period !== "" && !isMonth(p.period)) e.period = "Tulis bulan sebagai 2026-12.";
      if (!(Number.isInteger(p.amount) && p.amount > 0 && p.amount <= MAX_MONEY)) e.amount = "Wajib diisi, lebih dari 0.";
      date("due", p.due);
      oneOf("status", p.status, PAYMENT_STATUSES);
      date("paidAt", p.paidAt);
      break;
    }
    case "assets": {
      const a = d as Draft<Records["assets"]>;
      ref("clientId", a.clientId, false);
      ref("projectId", a.projectId, false);
      text(e, "item", a.item, 200, true);
      oneOf("kind", a.kind, ASSET_KINDS);
      text(e, "provider", a.provider, 200);
      money("cost", a.cost);
      date("renewal", a.renewal);
      text(e, "note", a.note, 5000);
      break;
    }
  }
  return e;
}
