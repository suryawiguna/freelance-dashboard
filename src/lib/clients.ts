/**
 * Semua yang dihitung per klien, tidak disimpan (docs/PLAN-KLIEN.md §2.4):
 * status, proyek utama, terakhir dihubungi, dan uangnya. Modul murni, dites.
 */
import { isActive, isDealt, phaseOf } from "../domain/projectFlow";
import type { Client, DateStr, Payment, Phase, Project, Stage } from "../domain/types";

/**
 * Urutan perhatian: yang sedang dikerjakan dulu, lalu yang masih dikejar,
 * lalu yang sudah live, lalu yang tutup (On hold, Selesai, Batal).
 */
const PHASE_RANK: Record<Phase, number> = { Dikerjakan: 0, Prospek: 1, Live: 2, Tutup: 3 };
const CLOSED_RANK: Partial<Record<Stage, number>> = { "On hold": 0, Selesai: 1, Batal: 2 };

/** Tanggal paling dekat yang butuh perhatian: berikutnya atau deadline. Kosong di belakang. */
export function attentionDate(p: Pick<Project, "nextDate" | "due" | "stage">): DateStr {
  const dates = [p.nextDate, phaseOf(p.stage) === "Dikerjakan" ? p.due : ""].filter(Boolean).sort();
  return dates[0] ?? "";
}

const byDateEmptyLast = (a: string, b: string) => (a === b ? 0 : !a ? 1 : !b ? -1 : a.localeCompare(b));

export function compareProjects(a: Project, b: Project): number {
  const pa = phaseOf(a.stage);
  const pb = phaseOf(b.stage);
  return (
    PHASE_RANK[pa] - PHASE_RANK[pb] ||
    (pa === "Tutup" ? (CLOSED_RANK[a.stage] ?? 9) - (CLOSED_RANK[b.stage] ?? 9) : 0) ||
    byDateEmptyLast(attentionDate(a), attentionDate(b)) ||
    a.name.localeCompare(b.name, "id")
  );
}

export interface ClientMoney {
  /** Total harga proyek yang sudah deal (termasuk Selesai). */
  deal: number;
  /** Total biaya bulanan proyek Live. */
  monthly: number;
  paid: number;
  unpaid: number;
}

export interface ClientView {
  client: Client;
  /** Urut perhatian: yang paling butuh perhatian di depan. */
  projects: Project[];
  primary: Project | null;
  /** Tahap proyek utama, atau null bila belum ada proyek. */
  stage: Stage | null;
  phase: Phase | null;
  /** Proyek lain yang masih berjalan selain proyek utama. */
  otherActive: number;
  lastContact: DateStr;
  money: ClientMoney;
}

export function lastContact(client: Pick<Client, "log">): DateStr {
  return client.log.reduce((max, e) => (e.date > max ? e.date : max), "");
}

export function clientMoney(projects: readonly Project[], payments: readonly Payment[]): ClientMoney {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    deal: sum(projects.filter((p) => isDealt(p.stage)).map((p) => p.price ?? 0)),
    monthly: sum(projects.filter((p) => p.stage === "Live").map((p) => p.monthly ?? 0)),
    paid: sum(payments.filter((p) => p.status === "Lunas").map((p) => p.amount)),
    unpaid: sum(payments.filter((p) => p.status !== "Lunas").map((p) => p.amount)),
  };
}

export function buildClientViews(
  clients: readonly Client[],
  projects: readonly Project[],
  payments: readonly Payment[],
): Map<string, ClientView> {
  const projectsOf = groupBy(projects, (p) => p.clientId);
  const paymentsOf = groupBy(payments, (p) => p.clientId);
  const out = new Map<string, ClientView>();
  for (const client of clients) {
    const mine = [...(projectsOf.get(client.id) ?? [])].sort(compareProjects);
    const primary = mine[0] ?? null;
    out.set(client.id, {
      client,
      projects: mine,
      primary,
      stage: primary?.stage ?? null,
      phase: primary ? phaseOf(primary.stage) : null,
      otherActive: mine.filter((p) => p !== primary && isActive(p.stage)).length,
      lastContact: lastContact(client),
      money: clientMoney(mine, paymentsOf.get(client.id) ?? []),
    });
  }
  return out;
}

function groupBy<T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const list = m.get(k);
    if (list) list.push(x);
    else m.set(k, [x]);
  }
  return m;
}
