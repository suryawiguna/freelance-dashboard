/**
 * Validasi form, cermin dari firestore.rules. Rules tetap penjaga terakhir;
 * ini supaya pesan salah muncul di field, bukan sebagai "permission denied".
 */
import { isDateStr } from "../lib/dates";
import type { CollectionName, Draft, Records } from "./records";
import {
  ASSET_KINDS,
  LEAD_SOURCES,
  LEAD_STAGES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PROJECT_STATUSES,
} from "./types";

export type Errors = Record<string, string>;

const MAX_MONEY = 100_000_000_000;

const isHttpsOrEmpty = (s: string) => s === "" || /^https:\/\/[^ ]+$/.test(s);
/** Sama dengan contactOrEmpty() di firestore.rules. */
export const isContact = (s: string) => isHttpsOrEmpty(s) || (s.length <= 320 && /^mailto:[^ @/]+@[^ @/]+\.[^ @/]+$/.test(s));
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

  switch (c) {
    case "leads": {
      const l = d as Draft<Records["leads"]>;
      text(e, "name", l.name, 200, true);
      text(e, "service", l.service, 200);
      if (l.source !== "") oneOf("source", l.source, LEAD_SOURCES);
      if (!isContact(l.contact)) e.contact = "Isi link lengkap (https://...) atau alamat email.";
      oneOf("stage", l.stage, LEAD_STAGES);
      money("value", l.value);
      money("monthly", l.monthly);
      if (l.branches !== null && !(Number.isInteger(l.branches) && l.branches >= 1 && l.branches <= 1000)) {
        e.branches = "Jumlah cabang 1 sampai 1000.";
      }
      date("followUp", l.followUp);
      text(e, "next", l.next, 1000);
      text(e, "note", l.note, 5000);
      break;
    }
    case "projects": {
      const p = d as Draft<Records["projects"]>;
      text(e, "client", p.client, 200, true);
      text(e, "name", p.name, 200);
      oneOf("status", p.status, PROJECT_STATUSES);
      money("monthly", p.monthly);
      date("due", p.due);
      url("link", p.link);
      text(e, "next", p.next, 1000);
      break;
    }
    case "payments": {
      const p = d as Draft<Records["payments"]>;
      text(e, "client", p.client, 200, true);
      text(e, "item", p.item, 200);
      oneOf("type", p.type, PAYMENT_TYPES);
      if (!(Number.isInteger(p.amount) && p.amount > 0 && p.amount <= MAX_MONEY)) e.amount = "Wajib diisi, lebih dari 0.";
      date("due", p.due);
      oneOf("status", p.status, PAYMENT_STATUSES);
      date("paidAt", p.paidAt);
      break;
    }
    case "assets": {
      const a = d as Draft<Records["assets"]>;
      text(e, "client", a.client, 200, true);
      text(e, "item", a.item, 200);
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
