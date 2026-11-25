# CLAUDE.md

Dashboard freelance pribadi Surya: lead, proyek, tagihan, aset. Satu pengguna. Rencana lengkap dan sumber kebenaran: [docs/PLAN.md](docs/PLAN.md).

Stack: React 19, Vite 6, TypeScript, Tailwind v4, Firebase (Auth Google, Firestore, Hosting) paket Spark, `vite-plugin-pwa` mode `prompt`, Vitest, emulator Firebase. Pola mengikuti repo `~/Documents/projects/kasir` (hanya dibaca).

Project Firebase: `freelance-dashboard-control` (https://freelance-dashboard-control.web.app), lihat `.firebaserc`.

## Alur kerja

- Setiap perubahan berakhir dengan `npm run lint`, `npm test`, `npm run test:rules` hijau.
- **Laporkan, lalu tunggu persetujuan** sebelum commit/push/deploy.
- Teks UI Bahasa Indonesia, sentence case, tanpa em dash. Uang `Rp1.400.000`, tanggal `27 Nov 2026`.

## Perintah

```bash
npm run emulators       # Firestore :8180 + Auth :9199 (Java 21). Bukan 8080/9099 supaya tidak bentrok dengan kasir
npm run seed:emulator   # isi emulator dengan data awal (scripts/seed-data.json = Lampiran A)
npm run dev:emulator    # aplikasi di :3100 ke emulator, ada tombol "Masuk sebagai pemilik (emulator)"
npm run dev             # ke project asli bila .env.local terisi, selain itu ke emulator
npm run lint            # tsc + scripts/check.mjs
npm test                # modul murni (src/**/*.test.ts)
npm run test:rules      # firestore.rules di emulator (tests/rules/). Matikan `npm run emulators` dulu (port sama)
npm run seed            # data awal ke project asli, sekali saja. Butuh service-account.json (di-gitignore)
npm run deploy          # lint + tes + build + hosting + firestore.rules. Butuh .env.local
```

## Aturan yang dijaga `npm run lint` (scripts/check.mjs)

- Semua akses Firestore lewat `src/data/repo.ts`.
- Tidak ada teks di bawah 16px. Skala teks hanya `text-base` (16), `text-lg` (18), `text-2xl` (24), `text-3xl` (32); ukuran lain dihapus dari theme di `src/index.css`.
- Tidak ada em dash di `.tsx`, tidak ada `confirm()`.
- UID pemilik di `firestore.rules` sama dengan `src/owner.ts`.

## Auth dan rules

- Pemilik = satu UID, tertulis di `firestore.rules` (`isOwner()`) dan `src/owner.ts`. Sudah diisi dengan UID akun Google Surya. Untuk mengganti akun: login dengan akun baru, layar "Belum ada akses" menampilkan UID-nya; ganti di dua file itu, `npm run lint`, `npm run deploy`.
- Rules deny-by-default, validasi tipe/panjang/enum/angka per koleksi, `createdAt`/`updatedAt` wajib `serverTimestamp()`. Enum di rules harus sama dengan `src/domain/types.ts`; tes rules mengiterasi enum dari file itu.
- Setiap aturan baru wajib punya tes di `tests/rules/`. Tes juga memastikan data awal lolos validasi.

## Arsitektur

- `App.tsx`: gerbang auth + router saja (`src/lib/route.ts`, History API). Tidak ada state bisnis.
- `src/data/DataContext.tsx`: satu `onSnapshot` per koleksi untuk seluruh aplikasi (lewat `repo.watch`). Dokumen dinormalisasi oleh `domain/records.ts` (field hilang diisi nilai kosong).
- Penulisan tidak di-`await` sampai server menjawab (offline persistence): panel langsung tertutup, error ditampilkan lewat toast.
- Panel edit = `?edit=<id>` atau `?edit=baru` di URL; membuka panel menambah entri history, jadi Back menutupnya. Ringkasan membuka panel di halaman lain lewat `openEdit(id, path)`.
- Keempat halaman memakai `features/shared/CollectionPage.tsx` dengan konfigurasi per koleksi (kolom, kartu HP, filter chip, form, CSV). Form generik di `features/shared/formModel.ts` (murni, dites).
- Angka ringkasan dan daftar tindak lanjut: `src/lib/summary.ts` (murni, dites; `WINDOW` berisi jendela hari).
