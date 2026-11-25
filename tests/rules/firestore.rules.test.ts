import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import {
  ASSET_KINDS,
  LEAD_SOURCES,
  LEAD_STAGES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PROJECT_STATUSES,
} from "../../src/domain/types";
import { OWNER_UID } from "../../src/owner";

/**
 * firestore.rules di emulator sungguhan (PLAN §4). Hanya pemilik yang bisa
 * membaca dan menulis; semua field divalidasi; koleksi lain tertutup.
 */

let env: RulesTestEnvironment;

const owner = () =>
  env
    .authenticatedContext(OWNER_UID, { email: "pemilik@example.com", email_verified: true })
    .firestore() as unknown as Firestore;
const stranger = () =>
  env
    .authenticatedContext("orang-lain", {
      email: "pemilik@example.com",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    })
    .firestore() as unknown as Firestore;
const anon = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

const stamps = () => ({ createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const OLD = Timestamp.fromDate(new Date("2026-11-01T00:00:00Z"));

/** Tulis langsung tanpa rules (seperti scripts/seed.mjs dengan firebase-admin). */
async function seed(path: string, data: DocumentData) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, path), data);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-freelance",
    firestore: { rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8") },
  });
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

// ---- Dokumen contoh (bentuk penuh yang ditulis aplikasi) ----

const LEAD = {
  name: "Aneka Ayam Manado",
  service: "Kasir (2 cabang)",
  source: "Threads",
  contact: "https://www.threads.com/messages/t/1129039183264155",
  stage: "Nego",
  value: 1_400_000,
  monthly: 290_000,
  branches: 2,
  followUp: "2026-11-27",
  next: "Siapkan pilot kasir-base",
  note: "Ayam segar",
};
const PROJECT = {
  client: "Aneka Ayam Manado",
  leadId: "aneka-ayam",
  name: "kasir-base (pilot)",
  status: "Dikerjakan",
  monthly: null,
  due: "",
  link: "https://kasir-demo.web.app",
  next: "Deploy dan pilot",
};
const PAYMENT = {
  client: "Aneka Ayam Manado",
  projectId: "kasir-base",
  item: "INV-001",
  type: "DP",
  amount: 700_000,
  due: "2026-12-01",
  status: "Belum",
  paidAt: "",
};
const ASSET = {
  client: "Semua calon klien",
  item: "kasir-demo.web.app",
  kind: "Firebase",
  provider: "Firebase (Spark)",
  cost: 0,
  renewal: "",
  note: "",
};

const COLLECTIONS = [
  { name: "leads", sample: LEAD },
  { name: "projects", sample: PROJECT },
  { name: "payments", sample: PAYMENT },
  { name: "assets", sample: ASSET },
] as const;

// ---- Akses ----

describe("akses", () => {
  for (const { name, sample } of COLLECTIONS) {
    describe(name, () => {
      it("pemilik bisa membaca, membuat, mengubah, dan menghapus", async () => {
        const db = owner();
        const ref = doc(db, name, "x");
        await assertSucceeds(setDoc(ref, { ...sample, ...stamps() }));
        await assertSucceeds(getDoc(ref));
        await assertSucceeds(getDocs(collection(db, name)));
        await assertSucceeds(updateDoc(ref, { updatedAt: serverTimestamp() }));
        await assertSucceeds(deleteDoc(ref));
      });

      it("tanpa login tidak bisa apa pun", async () => {
        await seed(`${name}/x`, { ...sample, createdAt: OLD, updatedAt: OLD });
        const db = anon();
        await assertFails(getDoc(doc(db, name, "x")));
        await assertFails(getDocs(collection(db, name)));
        await assertFails(setDoc(doc(db, name, "y"), { ...sample, ...stamps() }));
        await assertFails(deleteDoc(doc(db, name, "x")));
      });

      it("akun Google lain tidak bisa apa pun, walau emailnya sama", async () => {
        await seed(`${name}/x`, { ...sample, createdAt: OLD, updatedAt: OLD });
        const db = stranger();
        await assertFails(getDoc(doc(db, name, "x")));
        await assertFails(getDocs(collection(db, name)));
        await assertFails(setDoc(doc(db, name, "y"), { ...sample, ...stamps() }));
        await assertFails(updateDoc(doc(db, name, "x"), { updatedAt: serverTimestamp() }));
        await assertFails(deleteDoc(doc(db, name, "x")));
      });
    });
  }

  it("koleksi lain tertutup, juga untuk pemilik", async () => {
    const db = owner();
    await assertFails(getDoc(doc(db, "settings", "x")));
    await assertFails(setDoc(doc(db, "settings", "x"), { a: 1 }));
    await assertFails(setDoc(doc(db, "leads", "x", "sub", "y"), { a: 1 }));
  });
});

// ---- Cap waktu ----

describe("createdAt dan updatedAt", () => {
  for (const { name, sample } of COLLECTIONS) {
    describe(name, () => {
      it("wajib serverTimestamp saat dibuat", async () => {
        const ref = doc(owner(), name, "x");
        await assertFails(setDoc(ref, { ...sample, createdAt: OLD, updatedAt: serverTimestamp() }));
        await assertFails(setDoc(ref, { ...sample, createdAt: serverTimestamp(), updatedAt: OLD }));
        await assertFails(setDoc(ref, { ...sample, updatedAt: serverTimestamp() }));
      });

      it("createdAt tidak berubah dan updatedAt wajib diperbarui", async () => {
        await seed(`${name}/x`, { ...sample, createdAt: OLD, updatedAt: OLD });
        const ref = doc(owner(), name, "x");
        await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
        await assertFails(updateDoc(ref, { updatedAt: OLD }));
        await assertSucceeds(updateDoc(ref, { updatedAt: serverTimestamp() }));
      });
    });
  }
});

// ---- Validasi field ----

type Case = [label: string, patch: Record<string, unknown>];

/** Setiap patch dibuat di atas contoh yang valid dan harus ditolak. */
function rejects(name: string, sample: DocumentData, cases: Case[]) {
  for (const [label, patch] of cases) {
    it(`menolak ${label}`, async () => {
      const data: DocumentData = { ...sample, ...stamps() };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete data[k];
        else data[k] = v;
      }
      await assertFails(setDoc(doc(owner(), name, "x"), data));
    });
  }
}

/** Setiap patch harus diterima. */
function accepts(name: string, sample: DocumentData, cases: Case[]) {
  for (const [label, patch] of cases) {
    it(`menerima ${label}`, async () => {
      const data: DocumentData = { ...sample, ...stamps() };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete data[k];
        else data[k] = v;
      }
      await assertSucceeds(setDoc(doc(owner(), name, "x"), data));
    });
  }
}

const commonBad = (key: string): Case[] => [
  [`field asing`, { extra: 1 }],
  [`${key} kosong`, { [key]: "" }],
  [`${key} hanya spasi`, { [key]: "   " }],
  [`${key} bukan string`, { [key]: 5 }],
  [`${key} terlalu panjang`, { [key]: "a".repeat(201) }],
  [`${key} tidak ada`, { [key]: undefined }],
];

const badDates = (key: string): Case[] => [
  [`${key} format salah`, { [key]: "27-11-2026" }],
  [`${key} bulan 13`, { [key]: "2026-13-01" }],
  [`${key} null`, { [key]: null }],
  [`${key} Timestamp`, { [key]: OLD }],
];

const badMoney = (key: string): Case[] => [
  [`${key} negatif`, { [key]: -1 }],
  [`${key} desimal`, { [key]: 1.5 }],
  [`${key} string`, { [key]: "1400000" }],
  [`${key} terlalu besar`, { [key]: 100_000_000_001 }],
];

describe("leads", () => {
  accepts("leads", LEAD, [
    ...LEAD_SOURCES.map((s): Case => [`sumber ${s}`, { source: s }]),
    ["sumber kosong", { source: "" }],
    ...LEAD_STAGES.map((s): Case => [`tahap ${s}`, { stage: s }]),
    ["bentuk minimal (nama dan tahap saja)", Object.fromEntries(
      Object.keys(LEAD).filter((k) => k !== "name" && k !== "stage").map((k) => [k, undefined]),
    )],
    ["angka null", { value: null, monthly: null, branches: null }],
    ["kontak dan follow up kosong", { contact: "", followUp: "" }],
    ["kontak email (mailto:)", { source: "Email", contact: "mailto:halo@contoh.com" }],
  ]);
  rejects("leads", LEAD, [
    ...commonBad("name"),
    ["tahap di luar enum", { stage: "Menang" }],
    ["tahap huruf kecil", { stage: "nego" }],
    ["tahap tidak ada", { stage: undefined }],
    ["sumber di luar enum", { source: "TikTok" }],
    ["kontak http", { contact: "http://threads.com/x" }],
    ["kontak javascript:", { contact: "javascript:alert(1)" }],
    ["kontak bukan url", { contact: "082112345678" }],
    ["kontak email polos tanpa mailto:", { contact: "halo@contoh.com" }],
    ["kontak mailto rusak", { contact: "mailto:halo" }],
    ["kontak mailto dengan spasi", { contact: "mailto:a b@c.com" }],
    ...badMoney("value"),
    ...badMoney("monthly"),
    ["cabang 0", { branches: 0 }],
    ["cabang desimal", { branches: 1.5 }],
    ...badDates("followUp"),
    ["catatan terlalu panjang", { note: "a".repeat(5001) }],
    ["langkah berikutnya bukan string", { next: 1 }],
  ]);
});

describe("projects", () => {
  accepts("projects", PROJECT, [
    ...PROJECT_STATUSES.map((s): Case => [`status ${s}`, { status: s }]),
    ["tanpa lead asal", { leadId: null }],
    ["link kosong", { link: "" }],
  ]);
  rejects("projects", PROJECT, [
    ...commonBad("client"),
    ["status di luar enum", { status: "Batal" }],
    ["status tidak ada", { status: undefined }],
    ["leadId kosong", { leadId: "" }],
    ["leadId angka", { leadId: 1 }],
    ...badMoney("monthly"),
    ...badDates("due"),
    ["link http", { link: "http://kasir-demo.web.app" }],
  ]);
});

describe("payments", () => {
  accepts("payments", PAYMENT, [
    ...PAYMENT_TYPES.map((s): Case => [`jenis ${s}`, { type: s }]),
    ...PAYMENT_STATUSES.map((s): Case => [`status ${s}`, { status: s }]),
    ["lunas dengan tanggal bayar", { status: "Lunas", paidAt: "2026-11-25" }],
    ["tanpa proyek", { projectId: null }],
  ]);
  rejects("payments", PAYMENT, [
    ...commonBad("client"),
    ["jenis di luar enum", { type: "Bonus" }],
    ["status di luar enum", { status: "Sebagian" }],
    ["jumlah 0", { amount: 0 }],
    ["jumlah null", { amount: null }],
    ["jumlah tidak ada", { amount: undefined }],
    ...badMoney("amount"),
    ...badDates("due"),
    ...badDates("paidAt"),
  ]);
});

describe("assets", () => {
  accepts("assets", ASSET, [
    ...ASSET_KINDS.map((s): Case => [`jenis ${s}`, { kind: s }]),
    ["biaya null", { cost: null }],
    ["perpanjangan diisi", { renewal: "2027-01-10" }],
  ]);
  rejects("assets", ASSET, [
    ...commonBad("client"),
    ["jenis di luar enum", { kind: "VPS" }],
    ["jenis tidak ada", { kind: undefined }],
    ...badMoney("cost"),
    ...badDates("renewal"),
  ]);
});

// ---- Data awal (Lampiran A) ----

describe("data awal (scripts/seed-data.json, Lampiran A PLAN) lolos validasi", () => {
  const data = JSON.parse(readFileSync(resolve(__dirname, "../../scripts/seed-data.json"), "utf8")) as Record<
    string,
    Array<{ id: string } & DocumentData>
  >;

  for (const { name } of COLLECTIONS) {
    for (const { id, ...rest } of data[name] ?? []) {
      it(`${name}/${id}`, async () => {
        await assertSucceeds(setDoc(doc(owner(), name, id), { ...rest, ...stamps() }));
      });
    }
  }
});
