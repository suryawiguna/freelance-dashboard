/**
 * Semua angka dan daftar di halaman Hari ini (docs/PLAN-KLIEN.md §4.1).
 * Modul murni: tidak ada Firebase, tidak ada Date.now(); `today` selalu dari
 * luar supaya bisa dites.
 */
import { pendingMonthlyBills, type PendingBill } from "../domain/billing";
import { phaseOf } from "../domain/projectFlow";
import type { Asset, Client, DateStr, Payment, Project } from "../domain/types";
import { daysBetween, isDateStr, monthOf, relativeLabel } from "./dates";

export interface SummaryInput {
  clients: Client[];
  projects: Project[];
  payments: Payment[];
  assets: Asset[];
}

/** Jendela tiap kelompok, dalam hari ke depan. Yang sudah lewat selalu masuk. */
export const WINDOW = { contact: 3, work: 7, payment: 7, renewal: 30 } as const;

export type Group = keyof typeof WINDOW;
export const GROUPS: readonly Group[] = ["contact", "work", "payment", "renewal"];

export type Tone = "late" | "near";

export interface TodayItem {
  group: Group;
  collection: "projects" | "payments" | "assets";
  id: string;
  /** null untuk aset milik sendiri. */
  clientId: string | null;
  title: string;
  detail: string;
  date: DateStr;
  days: number;
  tone: Tone;
  label: string;
}

export interface Summary {
  groups: Record<Group, TodayItem[]>;
  /** Total biaya bulanan proyek Live. */
  monthlyRevenue: { count: number; total: number };
  unpaid: { count: number; total: number };
  paidThisMonth: { count: number; total: number };
  /** Proyek fase Prospek dan total harga penawarannya. */
  prospects: { count: number; total: number };
  /** Tagihan langganan bulan berjalan yang belum dibuat. */
  pendingBills: { month: string; bills: PendingBill[] };
}

const sum = (xs: Array<number | null>) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

export function summarize(input: SummaryInput, today: DateStr): Summary {
  const { clients, projects, payments, assets } = input;
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const nameOf = (id: string | null) => (id === null ? "Milik sendiri" : (clientName.get(id) ?? "Klien terhapus"));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const groups: Record<Group, TodayItem[]> = { contact: [], work: [], payment: [], renewal: [] };

  const push = (item: Omit<TodayItem, "days" | "tone" | "label">) => {
    if (!isDateStr(item.date)) return;
    const days = daysBetween(today, item.date);
    if (days > WINDOW[item.group]) return;
    groups[item.group].push({ ...item, days, tone: days < 0 ? "late" : "near", label: relativeLabel(days) });
  };

  for (const p of projects) {
    const phase = phaseOf(p.stage);
    const base = { collection: "projects" as const, id: p.id, clientId: p.clientId, title: nameOf(p.clientId) };
    const what = p.name || "Proyek";
    if (phase === "Prospek" || p.stage === "On hold") {
      const detail = p.name ? `${p.name}: ${p.next || "follow up"}` : p.next || "Follow up";
      push({ ...base, group: "contact", detail, date: p.nextDate });
    } else if (phase === "Dikerjakan" || p.stage === "Live") {
      // Satu baris per proyek: tanggal yang paling dekat antara langkah berikutnya dan deadline.
      const dueFirst = phase === "Dikerjakan" && isDateStr(p.due) && (!isDateStr(p.nextDate) || p.due < p.nextDate);
      push({
        ...base,
        group: "work",
        detail: dueFirst ? `${what}: deadline` : `${what}: ${p.next || "langkah berikutnya"}`,
        date: dueFirst ? p.due : p.nextDate,
      });
    }
  }

  const unpaid = payments.filter((p) => p.status !== "Lunas");
  for (const p of unpaid) {
    const of = p.projectId ? projectName.get(p.projectId) : "";
    const detail = [`Tagihan ${p.type}`, p.item || of].filter(Boolean).join(", ");
    push({ group: "payment", collection: "payments", id: p.id, clientId: p.clientId, title: nameOf(p.clientId), detail, date: p.due });
  }

  for (const a of assets) {
    push({
      group: "renewal",
      collection: "assets",
      id: a.id,
      clientId: a.clientId,
      title: a.item,
      detail: `Perpanjangan ${a.kind}, ${nameOf(a.clientId)}`,
      date: a.renewal,
    });
  }

  for (const g of GROUPS) groups[g].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "id"));

  const month = monthOf(today);
  const live = projects.filter((p) => p.stage === "Live" && (p.monthly ?? 0) > 0);
  const prospects = projects.filter((p) => phaseOf(p.stage) === "Prospek");
  const paid = payments.filter((p) => p.status === "Lunas" && isDateStr(p.paidAt) && monthOf(p.paidAt) === month);

  return {
    groups,
    monthlyRevenue: { count: live.length, total: sum(live.map((p) => p.monthly)) },
    unpaid: { count: unpaid.length, total: sum(unpaid.map((p) => p.amount)) },
    paidThisMonth: { count: paid.length, total: sum(paid.map((p) => p.amount)) },
    prospects: { count: prospects.length, total: sum(prospects.map((p) => p.price)) },
    pendingBills: { month, bills: pendingMonthlyBills(projects, payments, month) },
  };
}
