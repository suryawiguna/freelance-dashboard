/**
 * Model data (PLAN §5). Uang = integer rupiah. Tanggal = "YYYY-MM-DD"
 * (tanggal lokal WITA) atau "". firestore.rules memvalidasi bentuk yang sama;
 * tests/rules mengimpor enum dari sini supaya keduanya tidak bergeser.
 */

/** "YYYY-MM-DD" atau "" (belum diisi). */
export type DateStr = string;

export const LEAD_SOURCES = ["Threads", "Instagram", "WhatsApp", "Email", "Referral", "Website", "Lainnya"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STAGES = ["Baru", "Kirim harga", "Nego", "Deal", "On hold", "Tutup"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

/** Lead terbuka = masih dikejar. */
export const OPEN_LEAD_STAGES: readonly LeadStage[] = ["Baru", "Kirim harga", "Nego"];

export const PROJECT_STATUSES = ["Belum mulai", "Dikerjakan", "Revisi", "Live", "Maintenance", "Selesai"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PAYMENT_TYPES = ["DP", "Pelunasan", "Setup", "Langganan", "Lainnya"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = ["Belum", "Lunas"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ASSET_KINDS = ["Domain", "Hosting", "Firebase", "Cloudflare", "Lainnya"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export interface Lead {
  id: string;
  name: string;
  service: string;
  /** "" = belum diketahui. */
  source: LeadSource | "";
  /** Link DM Threads atau kontak lain. https saja, atau "". */
  contact: string;
  stage: LeadStage;
  value: number | null;
  monthly: number | null;
  branches: number | null;
  followUp: DateStr;
  next: string;
  note: string;
}

export interface Project {
  id: string;
  client: string;
  leadId: string | null;
  name: string;
  status: ProjectStatus;
  monthly: number | null;
  due: DateStr;
  link: string;
  next: string;
}

export interface Payment {
  id: string;
  client: string;
  projectId: string | null;
  item: string;
  type: PaymentType;
  amount: number;
  due: DateStr;
  status: PaymentStatus;
  paidAt: DateStr;
}

export interface Asset {
  id: string;
  client: string;
  item: string;
  kind: AssetKind;
  provider: string;
  cost: number | null;
  renewal: DateStr;
  note: string;
}
