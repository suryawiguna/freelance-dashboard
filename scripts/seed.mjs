#!/usr/bin/env node
/**
 * Import data awal (PLAN §9 fase 6, Lampiran A) dari scripts/seed-data.json.
 * Jalankan sekali saja.
 *
 *   npm run seed:emulator          emulator (project demo-freelance, port 8180)
 *   npm run seed                   project asli, butuh service-account.json di root
 *   npm run seed -- --force        tetap jalan walau koleksi sudah berisi
 *
 * Tanpa --force, script berhenti bila salah satu koleksi sudah punya dokumen,
 * supaya tidak menimpa data yang sudah diubah di aplikasi. Dengan --force,
 * hanya dokumen ber-id sama di data awal yang ditimpa; yang lain tidak disentuh.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const emulator = args.has("--emulator");
const force = args.has("--force");

const data = JSON.parse(readFileSync(join(ROOT, "scripts/seed-data.json"), "utf8"));
const COLLECTIONS = ["leads", "projects", "payments", "assets"];

let projectId;
if (emulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8180";
  projectId = "demo-freelance";
  initializeApp({ projectId });
} else {
  const saPath = ["service-account.json", "services-account.json"].map((f) => join(ROOT, f)).find(existsSync);
  if (!saPath) {
    console.error("service-account.json tidak ada di root repo. Unduh dari Firebase console > Project settings > Service accounts.");
    process.exit(1);
  }
  const sa = JSON.parse(readFileSync(saPath, "utf8"));
  const expected = JSON.parse(readFileSync(join(ROOT, ".firebaserc"), "utf8")).projects.default;
  if (sa.project_id !== expected) {
    console.error(`service-account.json untuk project "${sa.project_id}", bukan "${expected}" (.firebaserc).`);
    process.exit(1);
  }
  projectId = sa.project_id;
  initializeApp({ credential: cert(sa), projectId });
}

const db = getFirestore();

if (!force) {
  for (const c of COLLECTIONS) {
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
