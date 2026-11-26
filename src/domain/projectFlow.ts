/**
 * Alur proyek (docs/PLAN-KLIEN.md §5): tahap, cap tanggal deal/live, geser
 * tanggal berikutnya, dan tagihan DP/pelunasan saat deal. Modul murni, dites.
 */
import { addDays } from "../lib/dates.ts";
import type { Draft } from "./records.ts";
import {
  DEALT_STAGES,
  NEXT_REQUIRED_STAGES,
  STAGE_PHASE,
  type DateStr,
  type Payment,
  type Phase,
  type Project,
  type Service,
  type Stage,
} from "./types.ts";

export const phaseOf = (stage: Stage): Phase => STAGE_PHASE[stage];
export const isDealt = (stage: Stage) => DEALT_STAGES.includes(stage);
export const needsNext = (stage: Stage) => NEXT_REQUIRED_STAGES.includes(stage);
/** Proyek yang masih berjalan: belum Selesai, belum Batal, tidak ditunda. */
export const isActive = (stage: Stage) => phaseOf(stage) !== "Tutup";

/**
 * Geser tanggal berikutnya `days` hari dari tanggal sekarang, atau dari hari
 * ini bila kosong atau sudah lewat (supaya tidak jatuh di masa lalu).
 */
export function bumpDate(current: DateStr, today: DateStr, days = 3): DateStr {
  const base = current !== "" && current > today ? current : today;
  return addDays(base, days);
}

/** Isi dealAt dan liveAt otomatis saat tahap pertama kali sampai ke sana. */
export function stampStage<T extends Pick<Project, "stage" | "dealAt" | "liveAt">>(draft: T, today: DateStr): T {
  const out = { ...draft };
  if (isDealt(out.stage) && out.dealAt === "") out.dealAt = today;
  if (out.stage === "Live" && out.liveAt === "") out.liveAt = today;
  return out;
}

/** True bila perubahan tahap ini adalah momen deal (dari belum sepakat ke sudah). */
export function becameDealt(before: Stage | null, after: Stage): boolean {
  return isDealt(after) && (before === null || !isDealt(before));
}

/** DP dibulatkan ke ribuan terdekat supaya angkanya enak ditagih. */
const roundThousand = (n: number) => Math.round(n / 1000) * 1000;

/**
 * Tagihan saat deal, sesuai persen DP jasa (tanpa jasa: 50%). 100% = satu
 * tagihan Setup, 0% = satu tagihan Pelunasan, selain itu DP + Pelunasan.
 * DP jatuh tempo hari ini, pelunasan di deadline proyek (bila ada).
 */
export function dealBills(
  projectId: string,
  project: Pick<Project, "clientId" | "price" | "due">,
  service: Service | undefined,
  today: DateStr,
): Draft<Payment>[] {
  const price = project.price ?? 0;
  if (price <= 0) return [];
  const pct = service?.dpPercent ?? 50;
  const bill = (type: Payment["type"], amount: number, due: DateStr): Draft<Payment> => ({
    clientId: project.clientId,
    projectId,
    type,
    item: "",
    period: "",
    amount,
    due,
    status: "Belum",
    paidAt: "",
  });
  if (pct >= 100) return [bill("Setup", price, today)];
  if (pct <= 0) return [bill("Pelunasan", price, project.due)];
  const dp = Math.min(price, Math.max(1, roundThousand((price * pct) / 100)));
  if (dp >= price) return [bill("Setup", price, today)];
  return [bill("DP", dp, today), bill("Pelunasan", price - dp, project.due)];
}
