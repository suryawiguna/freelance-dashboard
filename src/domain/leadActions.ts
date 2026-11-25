import { addDays } from "../lib/dates";
import type { Draft } from "./records";
import type { DateStr, Lead, Project } from "./types";
import { KASIR_MONTHLY_PER_BRANCH } from "./records";

/**
 * "Follow up +3 hari": tiga hari dari tanggal follow up sekarang, atau dari
 * hari ini bila kosong atau sudah lewat (supaya tidak jatuh di masa lalu).
 */
export function bumpFollowUp(current: DateStr, today: DateStr, days = 3): DateStr {
  const base = current !== "" && current > today ? current : today;
  return addDays(base, days);
}

/** Biaya bulanan kasir dari jumlah cabang. */
export function monthlyForBranches(branches: number | null): number | null {
  return branches == null ? null : branches * KASIR_MONTHLY_PER_BRANCH;
}

/** "Jadikan proyek": klien, link, dan biaya bulanan sama dengan lead. */
export function projectFromLead(lead: Lead): Draft<Project> {
  return {
    client: lead.name,
    leadId: lead.id,
    name: lead.service,
    status: "Belum mulai",
    monthly: lead.monthly,
    due: "",
    link: lead.contact,
    next: lead.next,
  };
}
