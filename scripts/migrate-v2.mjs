#!/usr/bin/env node
/**
 * Migrasi data v1 ke v2 (docs/PLAN-KLIEN.md §7). Pemetaannya di
 * src/domain/migrateV1.ts (dites), diimpor langsung lewat type stripping Node.
 *
 *   npm run migrate:v2 -- --emulator --dry-run   lihat hasil pemetaan di emulator, tanpa menulis
 *   npm run migrate:v2 -- --emulator             tulis ke emulator
 *   npm run migrate:v2 -- --dry-run              lihat hasil di project asli (butuh service-account.json)
 *   npm run migrate:v2                           tulis ke project asli
 *   npm run migrate:v2 -- --hapus-lead           setelah hasilnya dicek: hapus koleksi leads v1
 *
 * Aman dijalankan ulang: berhenti bila data sudah v2 (koleksi clients berisi
 * atau proyek sudah punya clientId). Dokumen proyek, tagihan, dan aset v1
 * ditimpa di id yang sama; createdAt asli dipertahankan. Koleksi leads tidak
 * disentuh sampai --hapus-lead.
 */
import { FieldValue } from "firebase-admin/firestore";
import { migrateV1 } from "../src/domain/migrateV1.ts";
import { todayWita } from "../src/lib/dates.ts";
import { COLLECTIONS, connect } from "./lib/admin.mjs";

const args = new Set(process.argv.slice(2));
const emulator = args.has("--emulator");
const dryRun = args.has("--dry-run");
const dropLeads = args.has("--hapus-lead");

const { db, projectId } = connect(emulator);
const where = `${projectId}${emulator ? " (emulator)" : ""}`;

const read = async (c) => (await db.collection(c).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const [leads, projects, payments, assets, services, clients] = await Promise.all(
  ["leads", "projects", "payments", "assets", "services", "clients"].map(read),
);

const isV2 = clients.length > 0 || projects.some((p) => typeof p.clientId === "string");

if (dropLeads) {
  if (!isV2) {
    console.error(`Data di ${where} belum v2. Jalankan migrasi dulu, cek hasilnya, baru --hapus-lead.`);
    process.exit(1);
  }
  console.log(`${leads.length} dokumen leads di ${where} akan dihapus.`);
  if (dryRun || leads.length === 0) process.exit(0);
  await commitAll(leads.map((l) => (b) => b.delete(db.collection("leads").doc(l.id))));
  console.log("Koleksi leads dihapus.");
  process.exit(0);
}

if (isV2) {
  console.error(`Data di ${where} sudah v2 (clients berisi atau proyek sudah punya clientId). Tidak ada yang diubah.`);
  process.exit(1);
}

const today = todayWita();
const { data, report } = migrateV1({ leads, projects, payments, assets }, today, services);

console.log(`Migrasi v1 ke v2 di ${where}, tanggal ${today}${dryRun ? ", dry-run (tidak menulis)" : ""}.\n`);
console.log(`v1: ${leads.length} lead, ${projects.length} proyek, ${payments.length} tagihan, ${assets.length} aset.`);
console.log(
  `v2: ${data.services.length} jasa baru, ${data.clients.length} klien, ${data.projects.length} proyek, ` +
    `${data.payments.length} tagihan, ${data.assets.length} aset.\n`,
);
for (const line of report) console.log(`- ${line}`);
console.log("\nProyek:");
const clientName = new Map(data.clients.map((c) => [c.id, c.name]));
for (const p of data.projects) {
  const price = p.price === null ? "-" : `Rp${p.price.toLocaleString("id-ID")}`;
  console.log(`  ${clientName.get(p.clientId)} | ${p.name || "(tanpa nama)"} | ${p.stage} | ${price} | berikutnya ${p.nextDate || "-"}`);
}
if (dryRun) process.exit(0);

// createdAt asli dipertahankan: klien dari lead, proyek dari proyek v1 atau lead.
const created = new Map();
for (const [c, docs] of [["leads", leads], ["projects", projects], ["payments", payments], ["assets", assets]]) {
  for (const d of docs) if (d.createdAt) created.set(`${c}/${d.id}`, d.createdAt);
}
const createdAt = (...keys) => keys.map((k) => created.get(k)).find(Boolean) ?? FieldValue.serverTimestamp();
const sources = {
  services: () => [],
  clients: (id) => [`leads/${id}`],
  projects: (id) => [`projects/${id}`, `leads/${id}`],
  payments: (id) => [`payments/${id}`],
  assets: (id) => [`assets/${id}`],
};

const ops = [];
for (const c of COLLECTIONS) {
  for (const { id, ...doc } of data[c]) {
    const stamp = { createdAt: createdAt(...sources[c](id)), updatedAt: FieldValue.serverTimestamp() };
    ops.push((b) => b.set(db.collection(c).doc(id), { ...doc, ...stamp }));
  }
}
await commitAll(ops);
console.log(`\nSelesai: ${ops.length} dokumen ditulis ke ${where}. Koleksi leads belum dihapus (--hapus-lead).`);

/** Batch Firestore maksimal 500 operasi. Induk ditulis lebih dulu karena urutan COLLECTIONS. */
async function commitAll(list) {
  for (let i = 0; i < list.length; i += 450) {
    const batch = db.batch();
    for (const op of list.slice(i, i + 450)) op(batch);
    await batch.commit();
  }
}
