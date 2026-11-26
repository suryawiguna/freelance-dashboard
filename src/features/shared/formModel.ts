/**
 * Form generik untuk semua koleksi. Nilai form selalu string (apa yang
 * diketik), dikonversi ke record saat disimpan. Modul murni, dites.
 */
import { EMPTY, type CollectionName, type Draft, type Records } from "../../domain/records";
import type { PriceExtra } from "../../domain/types";
import { validate, type Errors } from "../../domain/validate";
import { parseRupiah } from "../../lib/money";

/**
 * "choice" = select yang tampil sebagai deretan chip (tahap/status, sekali klik).
 * "multi" = beberapa chip yang bisa dipilih sekaligus (nilai dipisah baris baru).
 * "toggle" = Ya/Tidak sebagai chip, disimpan sebagai boolean.
 * "pricelist" = daftar "Nama: harga" per baris (tambahan di jasa).
 */
export type FieldKind =
  | "text"
  | "textarea"
  | "url"
  | "contact"
  | "phone"
  | "money"
  | "count"
  | "date"
  | "select"
  | "choice"
  | "multi"
  | "toggle"
  | "pricelist";

export interface Option {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Untuk select, choice, multi, toggle. Nilai "" = pilihan kosong. */
  options?: readonly Option[];
  /** Select dengan nilai kosong disimpan sebagai null (mis. projectId). */
  nullable?: boolean;
  /** Judul bagian form. Field berurutan dengan judul sama dikelompokkan. */
  section?: string;
  /** Setengah lebar (dua kolom) mulai layar sm. */
  half?: boolean;
  /** Label, petunjuk, atau pilihan yang bergantung pada isian lain; hidden menyembunyikan field. */
  dynamic?: (values: FormValues) => Partial<Pick<FieldDef, "label" | "hint" | "options" | "placeholder" | "required">> & {
    hidden?: boolean;
  };
}

/** FieldDef setelah `dynamic` diterapkan. */
export function resolveField(f: FieldDef, values: FormValues): FieldDef & { hidden: boolean } {
  const d = f.dynamic?.(values) ?? {};
  return { ...f, ...d, hidden: d.hidden ?? false };
}

export interface FormSection {
  title: string;
  fields: FieldDef[];
}

/**
 * Kelompokkan field per bagian, urut kemunculan pertama. Saat menambah data
 * baru, bagian yang berisi isian wajib dipindah ke atas supaya diisi dulu;
 * saat mengedit, urutan konfigurasi dipakai (yang sering diubah di atas).
 */
export function formSections(fields: readonly FieldDef[], isNew: boolean): FormSection[] {
  const sections: FormSection[] = [];
  for (const f of fields) {
    const title = f.section ?? "";
    const s = sections.find((x) => x.title === title);
    if (s) s.fields.push(f);
    else sections.push({ title, fields: [f] });
  }
  if (!isNew) return sections;
  const hasRequired = (s: FormSection) => s.fields.some((f) => f.required);
  return [...sections.filter(hasRequired), ...sections.filter((s) => !hasRequired(s))];
}

export type FormValues = Record<string, string>;

const groups = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 1400000 jadi "1.400.000" (tanpa "Rp", untuk isi input). */
export const moneyInput = (n: number) => groups.format(n);

/** Nilai field multi: satu pilihan per baris. */
export const splitMulti = (v: string) => v.split("\n").filter(Boolean);
export const joinMulti = (xs: readonly string[]) => xs.join("\n");

/** "Booking via WhatsApp: 300.000" per baris. Baris yang rusak = null. */
export function parsePriceList(text: string): PriceExtra[] | null {
  const out: PriceExtra[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const i = line.lastIndexOf(":");
    if (i <= 0) return null;
    const price = parseRupiah(line.slice(i + 1));
    if (typeof price !== "number") return null;
    out.push({ name: line.slice(0, i).trim(), price });
  }
  return out;
}

export function toFormValues(fields: readonly FieldDef[], record: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const v = record[f.key];
    if (v === null || v === undefined) out[f.key] = "";
    else if (f.kind === "contact" && typeof v === "string") out[f.key] = v.replace(/^mailto:/, "");
    else if (f.kind === "money" && typeof v === "number") out[f.key] = v === 0 && f.key === "amount" ? "" : moneyInput(v);
    else if (f.kind === "multi" && Array.isArray(v)) out[f.key] = joinMulti(v.map(String));
    else if (f.kind === "pricelist" && Array.isArray(v)) {
      out[f.key] = (v as PriceExtra[]).map((x) => `${x.name}: ${moneyInput(x.price)}`).join("\n");
    } else out[f.key] = String(v);
  }
  return out;
}

export function fromFormValues<C extends CollectionName>(
  c: C,
  fields: readonly FieldDef[],
  values: FormValues,
  base: Draft<Records[C]> = EMPTY[c],
): { draft: Draft<Records[C]>; errors: Errors } {
  const draft: Record<string, unknown> = { ...base };
  const parseErrors: Errors = {};
  const empty = EMPTY[c] as unknown as Record<string, unknown>;

  for (const f of fields) {
    const raw = values[f.key] ?? "";
    switch (f.kind) {
      case "money": {
        const n = parseRupiah(raw);
        if (n === undefined) parseErrors[f.key] = "Tulis angka saja, contoh 1.400.000";
        // Field wajib angka (amount) tidak boleh null; validate() menolak 0.
        else draft[f.key] = n === null && empty[f.key] !== null ? 0 : n;
        break;
      }
      case "count": {
        const s = raw.trim();
        // Angka wajib (dpPercent) kosong jadi -1 supaya validate() menolaknya.
        if (s === "") draft[f.key] = empty[f.key] === null ? null : -1;
        else if (/^\d+$/.test(s)) draft[f.key] = Number(s);
        else parseErrors[f.key] = "Tulis angka bulat.";
        break;
      }
      case "select":
      case "choice":
        draft[f.key] = f.nullable && raw === "" ? null : raw;
        break;
      case "multi":
        draft[f.key] = splitMulti(raw);
        break;
      case "toggle":
        draft[f.key] = raw === "true";
        break;
      case "pricelist": {
        const list = parsePriceList(raw);
        if (list === null) parseErrors[f.key] = "Setiap baris: nama, titik dua, harga. Contoh: Booking via WhatsApp: 300.000";
        else draft[f.key] = list;
        break;
      }
      case "textarea":
        draft[f.key] = raw.trim();
        break;
      case "contact": {
        // Alamat email polos disimpan sebagai mailto: supaya tombolnya bisa membuka aplikasi email.
        const v = raw.trim();
        draft[f.key] = /^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(v) ? `mailto:${v}` : v;
        break;
      }
      default:
        draft[f.key] = raw.trim();
    }
  }

  const typed = draft as Draft<Records[C]>;
  return { draft: typed, errors: { ...validate(c, typed), ...parseErrors } };
}
