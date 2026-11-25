#!/usr/bin/env node
/**
 * Deploy ke Firebase Hosting + firestore.rules (PLAN §9 fase 5).
 *
 *   npm run deploy
 *
 * Berhenti bila config web belum diisi (tanpa config, build memakai emulator
 * dan tidak berguna di produksi), atau bila lint/tes gagal. UID pemilik yang
 * masih placeholder hanya diperingatkan: rules tetap menolak semua orang, dan
 * layar "Belum ada akses" di situs menampilkan UID untuk diisi.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const project = JSON.parse(readFileSync(join(ROOT, ".firebaserc"), "utf8")).projects.default;
const env = loadEnv("production", ROOT, "VITE_");

if (env.VITE_USE_EMULATOR === "true") {
  console.error("VITE_USE_EMULATOR=true di file env. Hapus dulu sebelum deploy.");
  process.exit(1);
}
if (env.VITE_FIREBASE_PROJECT_ID !== project) {
  console.error(
    `Config web belum diisi untuk "${project}" (VITE_FIREBASE_PROJECT_ID = "${env.VITE_FIREBASE_PROJECT_ID ?? ""}").\n` +
      "Isi .env.local dari Firebase console > Project settings > Your apps (lihat .env.example).",
  );
  process.exit(1);
}
for (const key of ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_APP_ID"]) {
  if (!env[key]) {
    console.error(`${key} kosong di .env.local.`);
    process.exit(1);
  }
}

if (readFileSync(join(ROOT, "firestore.rules"), "utf8").includes("OWNER_UID_BELUM_DIISI")) {
  console.warn(
    "\nPerhatian: UID pemilik masih placeholder. Rules akan menolak semua akun.\n" +
      "Login sekali di situs, salin UID dari layar 'Belum ada akses', isi di firestore.rules dan src/owner.ts, lalu deploy lagi.\n",
  );
}

const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: "inherit" });
run("npm run lint");
run("npm test");
run("npx vite build");
run(`npx --yes firebase-tools@15 deploy --only hosting,firestore:rules --project ${project}`);
