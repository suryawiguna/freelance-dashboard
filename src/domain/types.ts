/**
 * Model data v2 (docs/PLAN-KLIEN.md §3): klien sebagai pusat. Uang = integer
 * rupiah. Tanggal = "YYYY-MM-DD" (tanggal lokal WITA) atau "". Relasi lewat
 * id, tidak ada nama yang diduplikasi. firestore.rules memvalidasi bentuk yang
 * sama; tests/rules mengimpor enum dari sini supaya keduanya tidak bergeser.
 *
 * File ini dipakai juga oleh scripts/migrate-v2.mjs lewat type stripping Node,
 * jadi hanya boleh berisi sintaks TypeScript yang bisa dihapus (tanpa enum).
 */

/** "YYYY-MM-DD" atau "" (belum diisi). */
export type DateStr = string;

export const SOURCES = ["Threads", "Instagram", "WhatsApp", "Email", "Referral", "Website", "Lainnya"] as const;
export type Source = (typeof SOURCES)[number];

/** Satu perjalanan proyek, dari DM pertama sampai live atau tutup. */
export const STAGES = [
  "Baru",
  "Menunggu kabar",
  "Kirim harga",
  "Demo",
  "Nego",
  "Deal",
  "Dikerjakan",
  "Revisi",
  "Live",
  "Selesai",
  "On hold",
  "Batal",
] as const;
export type Stage = (typeof STAGES)[number];

export const PHASES = ["Prospek", "Dikerjakan", "Live", "Tutup"] as const;
export type Phase = (typeof PHASES)[number];

export const STAGE_PHASE: Record<Stage, Phase> = {
  Baru: "Prospek",
  "Menunggu kabar": "Prospek",
  "Kirim harga": "Prospek",
  Demo: "Prospek",
  Nego: "Prospek",
  Deal: "Dikerjakan",
  Dikerjakan: "Dikerjakan",
  Revisi: "Dikerjakan",
  Live: "Live",
  Selesai: "Tutup",
  "On hold": "Tutup",
  Batal: "Tutup",
};

/**
 * Tahap yang wajib punya tanggal langkah berikutnya: semua yang masih dikejar
 * atau dikerjakan, juga On hold supaya muncul lagi pada waktunya. Live,
 * Selesai, dan Batal boleh kosong.
 */
export const NEXT_REQUIRED_STAGES: readonly Stage[] = STAGES.filter(
  (s) => STAGE_PHASE[s] === "Prospek" || STAGE_PHASE[s] === "Dikerjakan" || s === "On hold",
);

/** Tahap setelah sepakat harga: harga di proyek menjadi harga deal. */
export const DEALT_STAGES: readonly Stage[] = ["Deal", "Dikerjakan", "Revisi", "Live", "Selesai"];

export const PAYMENT_TYPES = ["DP", "Pelunasan", "Setup", "Langganan", "Lainnya"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = ["Belum", "Lunas"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ASSET_KINDS = ["Domain", "Hosting", "Firebase", "Cloudflare", "Lainnya"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** Batas ukuran daftar di dalam dokumen (sama dengan firestore.rules). */
export const LIMITS = { log: 200, extras: 20 } as const;

export interface LogEntry {
  date: DateStr;
  text: string;
}

export interface Client {
  id: string;
  name: string;
  /** Link DM (https), "mailto:...", atau "". */
  contact: string;
  /** Nomor WA, opsional. */
  phone: string;
  /** "" = belum diketahui. */
  source: Source | "";
  /** Dari siapa (referral), postingan mana, dll. */
  sourceNote: string;
  note: string;
  /** Riwayat interaksi, terbaru di depan. */
  log: LogEntry[];
}

export interface PriceExtra {
  name: string;
  price: number;
}

export interface Service {
  id: string;
  name: string;
  /** Harga patokan setup atau proyek. */
  setup: number | null;
  /** Contoh: "mulai dari, tergantung fitur". */
  setupNote: string;
  monthly: number | null;
  /** Satuan pengali biaya bulanan, contoh "cabang". "" = tanpa pengali. */
  unit: string;
  /** Persen DP saat deal. 100 = bayar penuh di depan, 0 = tanpa DP. */
  dpPercent: number;
  extras: PriceExtra[];
  includes: string;
  active: boolean;
}

export interface Project {
  id: string;
  clientId: string;
  serviceId: string | null;
  name: string;
  stage: Stage;
  /** Harga penawaran, menjadi harga deal setelah Deal. Salinan, tidak ikut harga jasa. */
  price: number | null;
  /** Nama tambahan yang dipilih (salinan). */
  extras: string[];
  /** Jumlah unit, contoh jumlah cabang. */
  qty: number | null;
  monthly: number | null;
  next: string;
  nextDate: DateStr;
  due: DateStr;
  /** Link proyek atau demo. Link DM ada di klien. */
  link: string;
  dealAt: DateStr;
  liveAt: DateStr;
  note: string;
}

export interface Payment {
  id: string;
  clientId: string;
  projectId: string | null;
  type: PaymentType;
  item: string;
  /** "YYYY-MM" khusus Langganan, "" untuk yang lain. */
  period: string;
  amount: number;
  due: DateStr;
  status: PaymentStatus;
  paidAt: DateStr;
}

export interface Asset {
  id: string;
  /** null = milik sendiri (demo, infrastruktur bersama). */
  clientId: string | null;
  projectId: string | null;
  item: string;
  kind: AssetKind;
  provider: string;
  /** Biaya per tahun. */
  cost: number | null;
  renewal: DateStr;
  note: string;
}
