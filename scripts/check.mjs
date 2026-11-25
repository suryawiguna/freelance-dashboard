#!/usr/bin/env node
/**
 * Bagian dari `npm run lint`. Menjaga aturan PLAN yang tidak bisa dicek tsc:
 * - §8: semua akses Firestore lewat src/data/repo.ts.
 * - §7: tidak ada teks di bawah 16px (text-xs, text-sm, ukuran arbitrer kecil).
 * - §7: tidak ada em dash di teks UI.
 * - §6.2: hapus memakai konfirmasi di panel, bukan confirm().
 * - §7 mode gelap: tidak ada warna putih/hitam tetap; pakai token surface.
 * - §4: UID pemilik di firestore.rules sama dengan src/owner.ts.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");

const RULES = [
  {
    pattern: /\b(collection|doc|collectionGroup|getDocs?|setDoc|updateDoc|deleteDoc|addDoc|onSnapshot|writeBatch)\(/,
    only: /\.(ts|tsx)$/,
    allowed: new Set(["src/data/repo.ts"]),
    message: "Akses Firestore di luar src/data/repo.ts (PLAN §8).",
  },
  {
    pattern: /\btext-(xs|sm|\[(?:\d|\.)[^\]]*\])/,
    only: /\.(ts|tsx|css)$/,
    message: "Ukuran teks di bawah 16px atau arbitrer. Pakai text-base, text-lg, text-2xl, atau text-3xl (PLAN §7).",
  },
  {
    pattern: /font-size:\s*(?:0?\.\d+rem|(?:[0-9]|1[0-5])(?:\.\d+)?px|0?\.\d+em|small|x-small|xx-small|smaller)/,
    only: /\.(css|tsx)$/,
    message: "font-size di bawah 16px (PLAN §7).",
  },
  {
    pattern: /—/,
    only: /\.tsx$/,
    message: "Em dash di teks UI (PLAN §7). Pakai titik, koma, atau titik dua.",
  },
  {
    pattern: /\b(bg|text|border|from|to|via|fill|stroke)-white\b/,
    only: /\.(ts|tsx)$/,
    message: "Warna putih tetap merusak mode gelap. Pakai bg-surface / text-surface (src/index.css).",
  },
  {
    pattern: /\b(window\.)?confirm\(/,
    only: /\.tsx?$/,
    message: "confirm() dilarang. Pakai konfirmasi dua langkah di panel (PLAN §6.2).",
  },
];

const offenders = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      const rel = relative(ROOT, path);
      if (rel.endsWith(".test.ts")) continue;
      const lines = readFileSync(path, "utf8").split("\n");
      for (const rule of RULES) {
        if (rule.allowed?.has(rel) || !rule.only.test(rel)) continue;
        lines.forEach((line, i) => {
          if (rule.pattern.test(line)) offenders.push({ rule, where: `${rel}:${i + 1}  ${line.trim()}` });
        });
      }
    }
  }
};
walk(SRC);

const problems = [];
for (const rule of RULES) {
  const mine = offenders.filter((o) => o.rule === rule);
  if (mine.length) problems.push(`${rule.message}\n${mine.map((o) => `  ${o.where}`).join("\n")}`);
}

const rulesUid = /request\.auth\.uid == '([^']+)'/.exec(readFileSync(join(ROOT, "firestore.rules"), "utf8"))?.[1];
const appUid = /OWNER_UID = "([^"]+)"/.exec(readFileSync(join(SRC, "owner.ts"), "utf8"))?.[1];
if (!rulesUid || !appUid || rulesUid !== appUid) {
  problems.push(`UID pemilik beda: firestore.rules "${rulesUid}", src/owner.ts "${appUid}".`);
}

if (problems.length) {
  console.error(`\n${problems.join("\n\n")}\n`);
  process.exit(1);
}
console.log("check: ok");
