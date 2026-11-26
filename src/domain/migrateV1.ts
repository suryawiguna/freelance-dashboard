/**
 * Pemetaan data v1 (leads, projects, payments, assets berbasis nama klien)
 * ke v2 (docs/PLAN-KLIEN.md §7). Modul murni, dites, dan dipakai langsung oleh
 * scripts/migrate-v2.mjs lewat type stripping Node, jadi semua import memakai
 * ekstensi .ts dan hanya sintaks TypeScript yang bisa dihapus.
 */
import { isDateStr } from "../lib/dates.ts";
import { needsNext } from "./projectFlow.ts";
import type { Draft, Records } from "./records.ts";
import { ASSET_KINDS, PAYMENT_STATUSES, PAYMENT_TYPES, SOURCES, type Stage } from "./types.ts";

type Raw = { id: string } & Record<string, unknown>;
export interface V1Data {
  leads?: Raw[];
  projects?: Raw[];
  payments?: Raw[];
  assets?: Raw[];
}

type WithId<C extends keyof Records> = { id: string } & Draft<Records[C]>;
export interface V2Data {
  services: WithId<"services">[];
  clients: WithId<"clients">[];
  projects: WithId<"projects">[];
  payments: WithId<"payments">[];
  assets: WithId<"assets">[];
}

/** Jasa awal (PLAN-KLIEN §3). Harga bisa diubah di halaman Jasa. */
export const DEFAULT_SERVICES: WithId<"services">[] = [
  {
    id: "kasir",
    name: "Kasir",
    setup: 1_400_000,
    setupNote: "",
    monthly: 145_000,
    unit: "cabang",
    dpPercent: 50,
    extras: [],
    includes: "",
    active: true,
  },
  {
    id: "website",
    name: "Website",
    setup: 4_500_000,
    setupNote: "mulai dari, tergantung fitur",
    monthly: null,
    unit: "",
    dpPercent: 50,
    extras: [{ name: "Booking via WhatsApp", price: 300_000 }],
    includes: "",
    active: true,
  },
  {
    id: "upgrade-wordpress",
    name: "Upgrade WordPress",
    setup: null,
    setupNote: "harga belum ditentukan",
    monthly: null,
    unit: "",
    dpPercent: 50,
    extras: [],
    includes: "",
    active: true,
  },
];

const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
const key = (name: string) => name.trim().toLocaleLowerCase("id");
const https = (v: unknown) => (/^https:\/\/[^ ]+$/.test(s(v)) ? s(v) : "");
const contact = (v: unknown) => (https(v) || /^mailto:[^ @/]+@[^ @/]+\.[^ @/]+$/.test(s(v)) ? s(v) : "");
const date = (v: unknown) => (isDateStr(s(v)) ? s(v) : "");

const LEAD_STAGE: Record<string, Stage> = {
  Baru: "Baru",
  "Menunggu kabar": "Menunggu kabar",
  "Kirim harga": "Kirim harga",
  Demo: "Demo",
  Nego: "Nego",
  Deal: "Deal",
  "On hold": "On hold",
  Tutup: "Batal",
};
const PROJECT_STAGE: Record<string, Stage> = {
  "Belum mulai": "Deal",
  Dikerjakan: "Dikerjakan",
  Revisi: "Revisi",
  Live: "Live",
  Maintenance: "Live",
  Selesai: "Selesai",
};

function slug(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "klien";
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  taken.add(id);
  return id;
}

/** Jasa dari teks layanan v1, mis. "Kasir (2 cabang)" atau "Website + booking WA". */
export function matchService(text: string, services: readonly WithId<"services">[]): { serviceId: string | null; extras: string[] } {
  const t = text.toLowerCase();
  const find = (word: string) => services.find((x) => x.name.toLowerCase().includes(word))?.id ?? null;
  const serviceId = /wordpress/.test(t) ? find("wordpress") : /kasir/.test(t) ? find("kasir") : /web/.test(t) ? find("website") : null;
  const service = services.find((x) => x.id === serviceId);
  const extras =
    service && /booking/.test(t) ? service.extras.filter((x) => /booking/i.test(x.name)).map((x) => x.name) : [];
  return { serviceId, extras };
}

/**
 * `today` dipakai untuk nextDate proyek terbuka yang kosong, supaya langsung
 * muncul di Hari ini untuk dirapikan. `services` = jasa yang sudah ada di
 * database; kosong berarti DEFAULT_SERVICES ikut dibuat.
 */
export function migrateV1(v1: V1Data, today: string, existingServices: readonly WithId<"services">[] = []) {
  const report: string[] = [];
  const services = existingServices.length ? [] : DEFAULT_SERVICES.map((x) => ({ ...x, extras: [...x.extras] }));
  const allServices = existingServices.length ? existingServices : services;
  const out: V2Data = { services, clients: [], projects: [], payments: [], assets: [] };

  const takenClientIds = new Set<string>();
  const byName = new Map<string, string>();
  const addClient = (id: string, data: Draft<Records["clients"]>) => {
    takenClientIds.add(id);
    out.clients.push({ id, ...data });
    if (!byName.has(key(data.name))) byName.set(key(data.name), id);
    return id;
  };
  const clientFor = (name: string, why: string) => {
    const found = byName.get(key(name));
    if (found) return found;
    const id = slug(name, takenClientIds);
    report.push(`Klien baru "${name}" (${id}) dari ${why}.`);
    return addClient(id, { name, contact: "", phone: "", source: "", sourceNote: "", note: "", log: [] });
  };

  const leads = v1.leads ?? [];
  for (const l of leads) {
    const source = s(l.source);
    addClient(l.id, {
      name: s(l.name) || l.id,
      contact: contact(l.contact),
      phone: "",
      source: (SOURCES as readonly string[]).includes(source) ? (source as Records["clients"]["source"]) : "",
      sourceNote: "",
      note: s(l.note),
      log: [],
    });
  }

  const fromLead = (l: Raw): Draft<Records["projects"]> => {
    const service = s(l.service);
    const { serviceId, extras } = matchService(service, allServices);
    const branches = n(l.branches) ?? (Number(/(\d+)\s*cabang/i.exec(service)?.[1]) || null);
    return {
      clientId: l.id,
      serviceId,
      name: service,
      stage: LEAD_STAGE[s(l.stage)] ?? "Baru",
      price: n(l.value),
      extras,
      qty: branches,
      monthly: n(l.monthly),
      next: s(l.next),
      nextDate: date(l.followUp),
      due: "",
      link: "",
      dealAt: "",
      liveAt: "",
      note: "",
    };
  };

  const merged = new Set<string>();
  const projectIds = new Set<string>();
  for (const p of v1.projects ?? []) {
    const lead =
      leads.find((l) => l.id === s(p.leadId)) ??
      leads.find((l) => !merged.has(l.id) && key(s(l.name)) === key(s(p.client)));
    const base = lead
      ? fromLead(lead)
      : { ...fromLead({ id: clientFor(s(p.client) || p.id, `proyek ${p.id}`) }), name: "" };
    if (lead) {
      merged.add(lead.id);
      report.push(`Lead ${lead.id} + proyek ${p.id} jadi satu proyek ${p.id}.`);
    }
    projectIds.add(p.id);
    out.projects.push({
      id: p.id,
      ...base,
      name: s(p.name) || base.name,
      stage: PROJECT_STAGE[s(p.status)] ?? base.stage,
      monthly: n(p.monthly) ?? base.monthly,
      next: s(p.next) || base.next,
      due: date(p.due),
      link: https(p.link),
    });
  }
  for (const l of leads) {
    if (merged.has(l.id)) continue;
    const id = projectIds.has(l.id) ? `${l.id}-lead` : l.id;
    projectIds.add(id);
    out.projects.push({ id, ...fromLead(l) });
  }
  for (const p of out.projects) {
    if (needsNext(p.stage) && p.nextDate === "") {
      p.nextDate = today;
      report.push(`Proyek ${p.id} (${p.stage}) belum punya tanggal berikutnya, diisi ${today}.`);
    }
  }

  for (const p of v1.payments ?? []) {
    const type = s(p.type);
    const status = s(p.status);
    const projectId = projectIds.has(s(p.projectId)) ? s(p.projectId) : null;
    const clientId = projectId
      ? (out.projects.find((x) => x.id === projectId)?.clientId ?? clientFor(s(p.client), `tagihan ${p.id}`))
      : clientFor(s(p.client) || "Tanpa nama", `tagihan ${p.id}`);
    out.payments.push({
      id: p.id,
      clientId,
      projectId,
      type: (PAYMENT_TYPES as readonly string[]).includes(type) ? (type as Records["payments"]["type"]) : "Lainnya",
      item: s(p.item),
      period: "",
      amount: n(p.amount) ?? 0,
      due: date(p.due),
      status: (PAYMENT_STATUSES as readonly string[]).includes(status) ? (status as Records["payments"]["status"]) : "Belum",
      paidAt: date(p.paidAt),
    });
  }

  for (const a of v1.assets ?? []) {
    const client = s(a.client).trim();
    const own = client === "" || /^semua\b/i.test(client) || /sendiri/i.test(client);
    const kind = s(a.kind);
    out.assets.push({
      id: a.id,
      clientId: own ? null : clientFor(client, `aset ${a.id}`),
      projectId: null,
      item: s(a.item) || client || a.id,
      kind: (ASSET_KINDS as readonly string[]).includes(kind) ? (kind as Records["assets"]["kind"]) : "Lainnya",
      provider: s(a.provider),
      cost: n(a.cost),
      renewal: date(a.renewal),
      note: own && client ? [`Untuk: ${client}.`, s(a.note)].filter(Boolean).join(" ") : s(a.note),
    });
    if (own && client) report.push(`Aset ${a.id} ("${client}") jadi milik sendiri.`);
  }

  return { data: out, report };
}
