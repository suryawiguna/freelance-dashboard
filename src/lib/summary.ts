/**
 * Semua angka di halaman Ringkasan (PLAN §6.1). Modul murni: tidak ada
 * Firebase, tidak ada Date.now(); `today` selalu dari luar supaya bisa dites.
 */
import type { CollectionName } from "../domain/records";
import { OPEN_LEAD_STAGES, type Asset, type DateStr, type Lead, type Payment, type Project } from "../domain/types";
import { daysBetween, isDateStr, monthOf, relativeLabel } from "./dates";

export interface SummaryInput {
  leads: Lead[];
  projects: Project[];
  payments: Payment[];
  assets: Asset[];
}

/** Jendela "perlu ditindaklanjuti", dalam hari ke depan. Yang sudah lewat selalu masuk. */
export const WINDOW = { leadFollowUp: 3, projectDue: 7, paymentDue: 7, assetRenewal: 30 } as const;

/** Proyek yang deadline-nya masih relevan: belum Live dan belum Selesai. */
const PROJECT_IN_PROGRESS = new Set(["Belum mulai", "Dikerjakan", "Revisi"]);
/** Proyek yang menghasilkan pendapatan bulanan. */
const PROJECT_EARNING = new Set(["Live", "Maintenance"]);

export type Tone = "late" | "near";

export interface FollowItem {
  collection: CollectionName;
  id: string;
  title: string;
  detail: string;
  date: DateStr;
  days: number;
  tone: Tone;
  label: string;
}

export interface Summary {
  openLeads: { count: number; setupTotal: number };
  monthlyRevenue: number;
  unpaid: { count: number; total: number };
  paidThisMonth: { count: number; total: number };
  renewalsSoon: number;
  followUps: FollowItem[];
}

export const isOpenLead = (l: Lead) => OPEN_LEAD_STAGES.includes(l.stage);

const sum = (xs: Array<number | null>) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

/** Hari dari hari ini, atau null bila tanggal kosong / tidak valid. */
function daysFrom(today: DateStr, date: DateStr): number | null {
  return isDateStr(date) ? daysBetween(today, date) : null;
}

export function summarize(input: SummaryInput, today: DateStr): Summary {
  const { leads, projects, payments, assets } = input;
  const followUps: FollowItem[] = [];

  const push = (
    collection: CollectionName,
    id: string,
    title: string,
    detail: string,
    date: DateStr,
    window: number,
  ) => {
    const days = daysFrom(today, date);
    if (days === null || days > window) return;
    followUps.push({
      collection,
      id,
      title,
      detail,
      date,
      days,
      tone: days < 0 ? "late" : "near",
      label: relativeLabel(days),
    });
  };

  const open = leads.filter(isOpenLead);
  for (const l of open) push("leads", l.id, l.name, l.next || "Follow up", l.followUp, WINDOW.leadFollowUp);

  for (const p of projects) {
    if (PROJECT_IN_PROGRESS.has(p.status)) {
      push("projects", p.id, p.name || p.client, `Deadline, ${p.client}`, p.due, WINDOW.projectDue);
    }
  }

  const unpaid = payments.filter((p) => p.status !== "Lunas");
  for (const p of unpaid) {
    push("payments", p.id, p.client, `Tagihan ${p.type}${p.item ? `, ${p.item}` : ""}`, p.due, WINDOW.paymentDue);
  }

  let renewalsSoon = 0;
  for (const a of assets) {
    const days = daysFrom(today, a.renewal);
    if (days !== null && days <= WINDOW.assetRenewal) renewalsSoon++;
    push("assets", a.id, a.item || a.client, `Perpanjangan ${a.kind}, ${a.client}`, a.renewal, WINDOW.assetRenewal);
  }

  const thisMonth = monthOf(today);
  const paid = payments.filter((p) => p.status === "Lunas" && isDateStr(p.paidAt) && monthOf(p.paidAt) === thisMonth);

  const order: Record<CollectionName, number> = { leads: 0, projects: 1, payments: 2, assets: 3 };
  followUps.sort((a, b) => a.date.localeCompare(b.date) || order[a.collection] - order[b.collection] || a.title.localeCompare(b.title));

  return {
    openLeads: { count: open.length, setupTotal: sum(open.map((l) => l.value)) },
    monthlyRevenue: sum(projects.filter((p) => PROJECT_EARNING.has(p.status)).map((p) => p.monthly)),
    unpaid: { count: unpaid.length, total: sum(unpaid.map((p) => p.amount)) },
    paidThisMonth: { count: paid.length, total: sum(paid.map((p) => p.amount)) },
    renewalsSoon,
    followUps,
  };
}
