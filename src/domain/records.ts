/**
 * Bentuk kosong tiap koleksi dan normalisasi dokumen Firestore. Dokumen lama
 * atau hasil seed bisa tidak punya semua field (mis. `branches`); semua yang
 * hilang diisi nilai kosong supaya UI selalu menerima bentuk penuh.
 */
import type { Asset, Lead, Payment, Project } from "./types";

/** Biaya bulanan kasir per cabang (PLAN §5). */
export const KASIR_MONTHLY_PER_BRANCH = 145_000;

export interface Records {
  leads: Lead;
  projects: Project;
  payments: Payment;
  assets: Asset;
}
export type CollectionName = keyof Records;
export const COLLECTIONS: readonly CollectionName[] = ["leads", "projects", "payments", "assets"];

export type Draft<T> = Omit<T, "id">;

export const EMPTY: { [C in CollectionName]: Draft<Records[C]> } = {
  leads: {
    name: "",
    service: "",
    source: "",
    contact: "",
    stage: "Baru",
    value: null,
    monthly: null,
    branches: null,
    followUp: "",
    next: "",
    note: "",
  },
  projects: {
    client: "",
    leadId: null,
    name: "",
    status: "Belum mulai",
    monthly: null,
    due: "",
    link: "",
    next: "",
  },
  payments: {
    client: "",
    projectId: null,
    item: "",
    type: "DP",
    amount: 0,
    due: "",
    status: "Belum",
    paidAt: "",
  },
  assets: {
    client: "",
    item: "",
    kind: "Domain",
    provider: "",
    cost: null,
    renewal: "",
    note: "",
  },
};

/** Ambil hanya field yang dikenal; yang hilang atau salah tipe diisi nilai kosong. */
export function normalize<C extends CollectionName>(c: C, id: string, data: Record<string, unknown>): Records[C] {
  const empty = EMPTY[c] as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { id };
  for (const [key, fallback] of Object.entries(empty)) {
    const v = data[key];
    const ok =
      v !== undefined &&
      (fallback === null
        ? v === null || typeof v === "number" || typeof v === "string"
        : typeof v === typeof fallback);
    out[key] = ok ? v : fallback;
  }
  return out as unknown as Records[C];
}
