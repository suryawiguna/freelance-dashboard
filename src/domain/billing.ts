/**
 * Tagihan langganan bulanan (docs/PLAN-KLIEN.md §5 langkah 7). Satu tagihan
 * per proyek Live per bulan, dengan id `<projectId>-<YYYY-MM>` supaya tombol
 * yang terklik dua kali tidak membuat tagihan dobel. Modul murni, dites.
 */
import { dateInMonth, formatMonth, isDateStr, monthOf } from "../lib/dates.ts";
import type { Draft } from "./records.ts";
import type { Payment, Project } from "./types.ts";

export const monthlyBillId = (projectId: string, month: string) => `${projectId}-${month}`;

/** Jatuh tempo = tanggal yang sama dengan tanggal live, di bulan tagihan. Tanpa tanggal live: tanggal 1. */
export function monthlyDue(liveAt: string, month: string): string {
  const day = isDateStr(liveAt) ? Number(liveAt.slice(8, 10)) : 1;
  return dateInMonth(month, day);
}

export interface PendingBill {
  id: string;
  draft: Draft<Payment>;
}

/**
 * Tagihan langganan bulan `month` yang belum dibuat: proyek Live dengan biaya
 * bulanan, yang sudah live di bulan itu atau sebelumnya, dan belum punya
 * tagihan Langganan untuk bulan itu (dicek lewat id dan lewat period).
 */
export function pendingMonthlyBills(projects: readonly Project[], payments: readonly Payment[], month: string): PendingBill[] {
  const ids = new Set(payments.map((p) => p.id));
  const billed = new Set(
    payments.filter((p) => p.type === "Langganan" && p.period === month && p.projectId).map((p) => p.projectId),
  );
  return projects
    .filter((p) => p.stage === "Live" && (p.monthly ?? 0) > 0)
    .filter((p) => !isDateStr(p.liveAt) || monthOf(p.liveAt) <= month)
    .filter((p) => !ids.has(monthlyBillId(p.id, month)) && !billed.has(p.id))
    .map((p) => ({
      id: monthlyBillId(p.id, month),
      draft: {
        clientId: p.clientId,
        projectId: p.id,
        type: "Langganan",
        item: `Langganan ${formatMonth(month)}`,
        period: month,
        amount: p.monthly ?? 0,
        due: monthlyDue(p.liveAt, month),
        status: "Belum",
        paidAt: "",
      },
    }));
}
