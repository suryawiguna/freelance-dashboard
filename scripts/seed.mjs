#!/usr/bin/env node
/**
 * Import data awal v2 dari scripts/seed-data.json (hasil migrasi Lampiran A
 * PLAN.md, lihat docs/PLAN-KLIEN.md §7). Jalankan sekali saja.
 *
 *   npm run seed:emulator          emulator (project demo-freelance, port 8180)
 *   npm run seed                   project asli, butuh service-account.json di root
 *   npm run seed -- --force        tetap jalan walau koleksi sudah berisi
 *
 * Tanpa --force, script berhenti bila salah satu koleksi sudah punya dokumen,
 * supaya tidak menimpa data yang sudah diubah di aplikasi. Dengan --force,
 * hanya dokumen ber-id sama di data awal yang ditimpa; yang lain tidak disentuh.
 * Untuk data v1 yang sudah ada di project asli, pakai scripts/migrate-v2.mjs.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, connect, ROOT } from "./lib/admin.mjs";

const args = new Set(process.argv.slice(2));
const emulator = args.has("--emulator");
const force = args.has("--force");

const data = JSON.parse(readFileSync(join(ROOT, "scripts/seed-data.json"), "utf8"));
const { db, projectId } = connect(emulator);

if (!force) {
  for (const c of [...COLLECTIONS, "leads"]) {
    const snap = await db.collection(c).limit(1).get();
    if (!snap.empty) {
      console.error(`Koleksi "${c}" di ${projectId} sudah berisi. Seed hanya untuk sekali jalan; pakai --force untuk menimpa dokumen data awal.`);
      process.exit(1);
    }
  }
}

const batch = db.batch();
let count = 0;
for (const c of COLLECTIONS) {
  for (const { id, ...doc } of data[c] ?? []) {
    batch.set(db.collection(c).doc(id), {
      ...doc,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    count++;
  }
}
await batch.commit();
console.log(`Seed selesai: ${count} dokumen ke ${projectId}${emulator ? " (emulator)" : ""}.`);
