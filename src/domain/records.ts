/**
 * Bentuk kosong tiap koleksi dan normalisasi dokumen Firestore. Dokumen lama
 * atau hasil seed bisa tidak punya semua field; semua yang hilang atau salah
 * tipe diisi nilai kosong supaya UI selalu menerima bentuk penuh.
 */
import type { Asset, Client, LogEntry, Payment, PriceExtra, Project, Service } from "./types.ts";

export interface Records {
  services: Service;
  clients: Client;
  projects: Project;
  payments: Payment;
  assets: Asset;
}
export type CollectionName = keyof Records;

/** Urutan induk dulu: dipakai juga untuk urutan tulis seed dan migrasi. */
export const COLLECTIONS: readonly CollectionName[] = ["services", "clients", "projects", "payments", "assets"];

export type Draft<T> = Omit<T, "id">;

export const EMPTY: { [C in CollectionName]: Draft<Records[C]> } = {
  services: {
    name: "",
    setup: null,
    setupNote: "",
    monthly: null,
    unit: "",
    dpPercent: 50,
    extras: [],
    includes: "",
    active: true,
  },
  clients: {
    name: "",
    contact: "",
    phone: "",
    source: "",
    sourceNote: "",
    note: "",
    log: [],
  },
  projects: {
    clientId: "",
    serviceId: null,
    name: "",
    stage: "Baru",
    price: null,
    extras: [],
    qty: null,
    monthly: null,
    next: "",
    nextDate: "",
    due: "",
    link: "",
    dealAt: "",
    liveAt: "",
    note: "",
  },
  payments: {
    clientId: "",
    projectId: null,
    type: "DP",
    item: "",
    period: "",
    amount: 0,
    due: "",
    status: "Belum",
    paidAt: "",
  },
  assets: {
    clientId: null,
    projectId: null,
    item: "",
    kind: "Domain",
    provider: "",
    cost: null,
    renewal: "",
    note: "",
  },
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Elemen daftar yang rusak dibuang, bukan dikosongkan. */
const ITEMS: Record<string, (x: unknown) => unknown> = {
  "clients.log": (x): LogEntry | undefined =>
    isObj(x) && typeof x.date === "string" && typeof x.text === "string" ? { date: x.date, text: x.text } : undefined,
  "services.extras": (x): PriceExtra | undefined =>
    isObj(x) && typeof x.name === "string" && typeof x.price === "number" ? { name: x.name, price: x.price } : undefined,
  "projects.extras": (x) => (typeof x === "string" ? x : undefined),
};

/** Ambil hanya field yang dikenal; yang hilang atau salah tipe diisi nilai kosong. */
export function normalize<C extends CollectionName>(c: C, id: string, data: Record<string, unknown>): Records[C] {
  const empty = EMPTY[c] as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { id };
  for (const [key, fallback] of Object.entries(empty)) {
    const v = data[key];
    if (Array.isArray(fallback)) {
      const item = ITEMS[`${c}.${key}`];
      out[key] = Array.isArray(v) && item ? v.map(item).filter((x) => x !== undefined) : [];
      continue;
    }
    const ok =
      v !== undefined &&
      (fallback === null
        ? v === null || typeof v === "number" || typeof v === "string"
        : typeof v === typeof fallback);
    out[key] = ok ? v : fallback;
  }
  return out as unknown as Records[C];
}
