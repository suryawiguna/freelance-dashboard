import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
  writeBatch,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import {
  ASSET_KINDS,
  GUIDE_MAX,
  NEXT_REQUIRED_STAGES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  SOURCES,
  STAGES,
} from "../../src/domain/types";
import { OWNER_UID } from "../../src/owner";

/**
 * firestore.rules di emulator sungguhan (PLAN §4, model PLAN-KLIEN §3). Hanya
 * pemilik yang bisa membaca dan menulis; semua field divalidasi; relasi harus
 * menunjuk dokumen yang ada; koleksi lain tertutup.
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

// ---- Dokumen contoh (bentuk penuh yang ditulis aplikasi) ----

const SERVICE = {
  name: "Kasir",
  setup: 1_400_000,
  setupNote: "",
  monthly: 145_000,
  unit: "cabang",
  dpPercent: 50,
  extras: [{ name: "Printer struk", price: 350_000 }],
  includes: "Setup, pelatihan",
  active: true,
};
const CLIENT = {
  name: "Aneka Ayam Manado",
  contact: "https://www.threads.com/messages/t/1129039183264155",
  phone: "0812 3456 7890",
  source: "Threads",
  sourceNote: "Balas postingan kasir",
  note: "Ayam segar",
  log: [{ date: "2026-11-25", text: "Kirim harga" }],
};
const PROJECT = {
  clientId: "c1",
  serviceId: "s1",
  name: "Kasir 2 cabang",
  stage: "Dikerjakan",
  price: 1_400_000,
  extras: ["Printer struk"],
  qty: 2,
  monthly: 290_000,
  next: "Deploy dan pilot",
  nextDate: "2026-11-27",
  due: "2026-12-10",
  link: "https://kasir-demo.web.app",
  dealAt: "2026-11-20",
  liveAt: "",
  note: "",
};
const PAYMENT = {
  clientId: "c1",
  projectId: "p1",
  type: "DP",
  item: "INV-001",
  period: "",
  amount: 700_000,
  due: "2026-12-01",
  status: "Belum",
  paidAt: "",
};
const ASSET = {
  clientId: "c1",
  projectId: "p1",
  item: "anekaayam.com",
  kind: "Domain",
  provider: "Niagahoster",
  cost: 150_000,
  renewal: "2027-01-10",
  note: "",
};

const GUIDE = { body: "# SOP\n\n**Follow-up H+3:**\n> Halo kak" };

/** Induk yang dirujuk contoh di atas: clients/c1, services/s1, projects/p1. */
async function seedParents() {
  await seed("services/s1", { ...SERVICE, createdAt: OLD, updatedAt: OLD });
  await seed("clients/c1", { ...CLIENT, createdAt: OLD, updatedAt: OLD });
  await seed("projects/p1", { ...PROJECT, createdAt: OLD, updatedAt: OLD });
}

beforeEach(async () => {
  await env.clearFirestore();
  await seedParents();
});

const COLLECTIONS = [
  { name: "services", sample: SERVICE },
  { name: "clients", sample: CLIENT },
  { name: "projects", sample: PROJECT },
  { name: "payments", sample: PAYMENT },
  { name: "assets", sample: ASSET },
  { name: "guides", sample: GUIDE },
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
    await assertFails(setDoc(doc(db, "clients", "x", "sub", "y"), { a: 1 }));
    await assertFails(getDoc(doc(db, "leads", "x")));
    await assertFails(setDoc(doc(db, "leads", "x"), { name: "A", stage: "Baru", ...stamps() }));
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

describe("services", () => {
  accepts("services", SERVICE, [
    ["bentuk minimal (nama saja)", Object.fromEntries(Object.keys(SERVICE).filter((k) => k !== "name").map((k) => [k, undefined]))],
    ["harga null", { setup: null, monthly: null }],
    ["DP 0 dan 100", { dpPercent: 0 }],
    ["DP 100", { dpPercent: 100 }],
    ["tidak aktif", { active: false }],
    ["tanpa tambahan", { extras: [] }],
  ]);
  rejects("services", SERVICE, [
    ...commonBad("name"),
    ...badMoney("setup"),
    ...badMoney("monthly"),
    ["DP di atas 100", { dpPercent: 101 }],
    ["DP negatif", { dpPercent: -1 }],
    ["DP desimal", { dpPercent: 12.5 }],
    ["DP null", { dpPercent: null }],
    ["aktif bukan bool", { active: "ya" }],
    ["tambahan bukan list", { extras: "Printer" }],
    ["tambahan lebih dari 20", { extras: Array.from({ length: 21 }, (_, i) => ({ name: `x${i}`, price: 1 })) }],
    ["satuan terlalu panjang", { unit: "a".repeat(51) }],
  ]);
});

describe("clients", () => {
  accepts("clients", CLIENT, [
    ...SOURCES.map((s): Case => [`sumber ${s}`, { source: s }]),
    ["sumber kosong", { source: "" }],
    ["bentuk minimal (nama saja)", Object.fromEntries(Object.keys(CLIENT).filter((k) => k !== "name").map((k) => [k, undefined]))],
    ["kontak dan WA kosong", { contact: "", phone: "" }],
    ["kontak email (mailto:)", { source: "Email", contact: "mailto:halo@contoh.com" }],
    ["WA dengan +62 dan tanda hubung", { phone: "+62 812-3456-7890" }],
    ["log 200 catatan", { log: Array.from({ length: 200 }, () => ({ date: "2026-11-25", text: "x" })) }],
  ]);
  rejects("clients", CLIENT, [
    ...commonBad("name"),
    ["sumber di luar enum", { source: "TikTok" }],
    ["kontak http", { contact: "http://threads.com/x" }],
    ["kontak javascript:", { contact: "javascript:alert(1)" }],
    ["kontak email polos tanpa mailto:", { contact: "halo@contoh.com" }],
    ["kontak mailto rusak", { contact: "mailto:halo" }],
    ["WA berisi huruf", { phone: "0812abc" }],
    ["WA terlalu panjang", { phone: "1".repeat(31) }],
    ["log bukan list", { log: "x" }],
    ["log lebih dari 200", { log: Array.from({ length: 201 }, () => ({ date: "2026-11-25", text: "x" })) }],
    ["catatan terlalu panjang", { note: "a".repeat(5001) }],
    ["field v1 (stage)", { stage: "Nego" }],
  ]);
});

describe("projects", () => {
  accepts("projects", PROJECT, [
    ...STAGES.map((s): Case => [`tahap ${s}`, { stage: s }]),
    ["tanpa jasa", { serviceId: null }],
    ["bentuk minimal (klien, tahap, tanggal berikutnya)", Object.fromEntries(
      Object.keys(PROJECT).filter((k) => !["clientId", "stage", "nextDate"].includes(k)).map((k) => [k, undefined]),
    )],
    ["angka null", { price: null, qty: null, monthly: null }],
    ["Live tanpa tanggal berikutnya", { stage: "Live", nextDate: "" }],
    ["Selesai tanpa tanggal berikutnya", { stage: "Selesai", nextDate: "" }],
    ["Batal tanpa tanggal berikutnya", { stage: "Batal", nextDate: "" }],
  ]);
  rejects("projects", PROJECT, [
    ["field asing", { extra: 1 }],
    ["klien tidak ada", { clientId: "tidak-ada" }],
    ["klien kosong", { clientId: "" }],
    ["klien null", { clientId: null }],
    ["klien tidak diisi", { clientId: undefined }],
    ["jasa tidak ada", { serviceId: "tidak-ada" }],
    ["jasa kosong", { serviceId: "" }],
    ["tahap di luar enum", { stage: "Menang" }],
    ["tahap v1 Tutup", { stage: "Tutup" }],
    ["tahap tidak ada", { stage: undefined }],
    ...NEXT_REQUIRED_STAGES.map((s): Case => [`${s} tanpa tanggal berikutnya`, { stage: s, nextDate: "" }]),
    ...NEXT_REQUIRED_STAGES.map((s): Case => [`${s} tanpa field nextDate`, { stage: s, nextDate: undefined }]),
    ...badMoney("price"),
    ...badMoney("monthly"),
    ["jumlah unit 0", { qty: 0 }],
    ["tambahan bukan list", { extras: "Printer" }],
    ...badDates("nextDate"),
    ...badDates("due"),
    ...badDates("dealAt"),
    ...badDates("liveAt"),
    ["link http", { link: "http://kasir-demo.web.app" }],
    ["field v1 (client)", { client: "Aneka Ayam" }],
  ]);

  it("klien dan proyek pertamanya bisa dibuat dalam satu batch", async () => {
    const db = owner();
    const batch = writeBatch(db);
    batch.set(doc(db, "clients", "baru"), { name: "Cumeyume", ...stamps() });
    batch.set(doc(db, "projects", "baru-1"), { clientId: "baru", stage: "Baru", nextDate: "2026-11-27", ...stamps() });
    await assertSucceeds(batch.commit());
  });

  it("enum tahap wajib tanggal sama dengan needsNext() di rules", () => {
    const rules = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");
    const list = /function needsNext\(stage\) \{\s*return stage in \[([^\]]+)\]/.exec(rules)?.[1] ?? "";
    expect(list.split(",").map((x) => x.trim().replace(/'/g, ""))).toEqual([...NEXT_REQUIRED_STAGES]);
  });
});

describe("payments", () => {
  accepts("payments", PAYMENT, [
    ...PAYMENT_TYPES.map((s): Case => [`jenis ${s}`, { type: s }]),
    ...PAYMENT_STATUSES.map((s): Case => [`status ${s}`, { status: s }]),
    ["lunas dengan tanggal bayar", { status: "Lunas", paidAt: "2026-11-25" }],
    ["tanpa proyek", { projectId: null }],
    ["langganan dengan bulan", { type: "Langganan", period: "2026-12" }],
  ]);
  rejects("payments", PAYMENT, [
    ["field asing", { extra: 1 }],
    ["klien tidak ada", { clientId: "tidak-ada" }],
    ["klien tidak diisi", { clientId: undefined }],
    ["proyek tidak ada", { projectId: "tidak-ada" }],
    ["proyek kosong", { projectId: "" }],
    ["jenis di luar enum", { type: "Bonus" }],
    ["status di luar enum", { status: "Sebagian" }],
    ["bulan format salah", { period: "12-2026" }],
    ["bulan dengan tanggal", { period: "2026-12-01" }],
    ["jumlah 0", { amount: 0 }],
    ["jumlah null", { amount: null }],
    ["jumlah tidak ada", { amount: undefined }],
    ...badMoney("amount"),
    ...badDates("due"),
    ...badDates("paidAt"),
    ["field v1 (client)", { client: "Aneka Ayam" }],
  ]);
});

describe("assets", () => {
  accepts("assets", ASSET, [
    ...ASSET_KINDS.map((s): Case => [`jenis ${s}`, { kind: s }]),
    ["milik sendiri (klien null)", { clientId: null, projectId: null }],
    ["biaya null", { cost: null }],
    ["perpanjangan kosong", { renewal: "" }],
  ]);
  rejects("assets", ASSET, [
    ...commonBad("item"),
    ["klien tidak ada", { clientId: "tidak-ada" }],
    ["klien kosong", { clientId: "" }],
    ["proyek tidak ada", { projectId: "tidak-ada" }],
    ["jenis di luar enum", { kind: "VPS" }],
    ["jenis tidak ada", { kind: undefined }],
    ...badMoney("cost"),
    ...badDates("renewal"),
  ]);
});

// ---- Data awal (scripts/seed-data.json, hasil migrasi Lampiran A) ----

describe("guides", () => {
  accepts("guides", GUIDE, [
    ["body kosong", { body: "" }],
    ["body tepat di batas", { body: "a".repeat(GUIDE_MAX) }],
  ]);
  rejects("guides", GUIDE, [
    ["field asing", { title: "SOP" }],
    ["body tidak ada", { body: undefined }],
    ["body bukan string", { body: 5 }],
    ["body null", { body: null }],
    ["body terlalu panjang", { body: "a".repeat(GUIDE_MAX + 1) }],
  ]);
});

describe("data awal (scripts/seed-data.json) lolos validasi", () => {
  const data = JSON.parse(readFileSync(resolve(__dirname, "../../scripts/seed-data.json"), "utf8")) as Record<
    string,
    Array<{ id: string } & DocumentData>
  >;
  const all = COLLECTIONS.flatMap(({ name }) => (data[name] ?? []).map(({ id, ...doc }) => ({ col: name, id, doc })));

  for (const { col, id, doc: data } of all) {
    it(`${col}/${id}`, async () => {
      // Dokumen lain dari data awal sudah ada (induknya), lalu dokumen ini ditulis lewat rules.
      await env.clearFirestore();
      for (const other of all) {
        if (other.col === col && other.id === id) continue;
        await seed(`${other.col}/${other.id}`, { ...other.doc, createdAt: OLD, updatedAt: OLD });
      }
      await assertSucceeds(setDoc(doc(owner(), col, id), { ...data, ...stamps() }));
    });
  }
});
