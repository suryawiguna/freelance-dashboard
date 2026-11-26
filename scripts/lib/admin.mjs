/**
 * Koneksi firebase-admin bersama untuk scripts/seed.mjs dan scripts/migrate-v2.mjs.
 *   --emulator   emulator (project demo-freelance, port 8180)
 *   tanpa flag   project asli, butuh service-account.json di root (di-gitignore)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Induk dulu, supaya urutan tulis selalu aman. Sama dengan COLLECTIONS di src/domain/records.ts. */
export const COLLECTIONS = ["services", "clients", "projects", "payments", "assets"];

export function connect(emulator) {
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
  return { db: getFirestore(), projectId };
}
