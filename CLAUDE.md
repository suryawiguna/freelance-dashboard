# CLAUDE.md

Dashboard freelance pribadi Surya, berpusat pada klien: klien, proyek (dari prospek sampai live), tagihan, aset, dan daftar jasa sebagai patokan harga. Satu pengguna. Sumber kebenaran: [docs/PLAN-KLIEN.md](docs/PLAN-KLIEN.md) untuk model data, halaman, dan alur (v2); [docs/PLAN.md](docs/PLAN.md) untuk auth, desain, stack, dan aturan kode.

Stack: React 19, Vite 6, TypeScript, Tailwind v4, Firebase (Auth Google, Firestore, Hosting) paket Spark, `vite-plugin-pwa` mode `prompt`, Vitest, emulator Firebase. Pola mengikuti repo `~/Documents/projects/kasir` (hanya dibaca).

Project Firebase: `freelance-dashboard-control` (https://freelance-dashboard-control.web.app), lihat `.firebaserc`.

## Alur kerja

- Setiap perubahan berakhir dengan `npm run lint`, `npm test`, `npm run test:rules` hijau.
- **Laporkan, lalu tunggu persetujuan** sebelum commit/push/deploy.
- Teks UI Bahasa Indonesia, sentence case, tanpa em dash. Uang `Rp1.400.000`, tanggal `27 Nov 2026`.

## Perintah

```bash
npm run emulators       # Firestore :8180 + Auth :9199 (Java 21). Bukan 8080/9099 supaya tidak bentrok dengan kasir
npm run seed:emulator   # isi emulator dengan data awal v2 (scripts/seed-data.json = Lampiran A setelah migrasi)
npm run dev:emulator    # aplikasi di :3000 ke emulator, ada tombol "Masuk sebagai pemilik (emulator)"
npm run dev             # ke project asli bila .env.local terisi, selain itu ke emulator
npm run lint            # tsc + scripts/check.mjs
npm test                # modul murni (src/**/*.test.ts)
npm run test:rules      # firestore.rules di emulator (tests/rules/). Matikan `npm run emulators` dulu (port sama)
npm run seed            # data awal ke project asli, sekali saja. Butuh service-account.json (di-gitignore)
npm run migrate:v2 -- --dry-run   # data v1 (leads, client sebagai nama) ke v2. Tambah --emulator untuk emulator
npm run deploy          # lint + tes + build + hosting + firestore.rules. Butuh .env.local
```

## Aturan yang dijaga `npm run lint` (scripts/check.mjs)

- Semua akses Firestore lewat `src/data/repo.ts`.
- Skala teks hanya `text-base`, `text-lg`, `text-2xl`, `text-3xl` (16/18/24/32 di HP, 14/15,75/21/28 di desktop lewat `html { font-size: 87.5% }` mulai 1024px); ukuran lain dihapus dari theme di `src/index.css`. Ukuran apa pun pakai rem, bukan px.
- Tidak ada em dash di `.tsx`, tidak ada `confirm()`.
- UID pemilik di `firestore.rules` sama dengan `src/owner.ts`.

## Auth dan rules

- Pemilik = satu UID, tertulis di `firestore.rules` (`isOwner()`) dan `src/owner.ts`. Sudah diisi dengan UID akun Google Surya. Untuk mengganti akun: login dengan akun baru, layar "Belum ada akses" menampilkan UID-nya; ganti di dua file itu, `npm run lint`, `npm run deploy`.
- Rules deny-by-default, validasi tipe/panjang/enum/angka per koleksi, `createdAt`/`updatedAt` wajib `serverTimestamp()`. Relasi (`clientId`, `projectId`, `serviceId`) wajib menunjuk dokumen yang ada (`existsAfter`, jadi klien + proyek pertamanya bisa satu batch). Proyek fase Prospek/Dikerjakan/On hold wajib `nextDate`. Enum di rules harus sama dengan `src/domain/types.ts`; tes rules mengiterasi enum dari file itu.
- Setiap aturan baru wajib punya tes di `tests/rules/`. Tes juga memastikan data awal lolos validasi.

## Arsitektur

- Koleksi: `services` (jasa), `clients`, `projects`, `payments`, `assets`. Relasi lewat id, nama tidak pernah disalin; status klien, terakhir dihubungi, dan total uang dihitung (`src/lib/clients.ts`), tidak disimpan. Harga di proyek dan nominal tagihan adalah salinan.
- `App.tsx`: gerbang auth + router saja (`src/lib/route.ts`, History API: `/`, `/klien`, `/klien/:id`, `/uang`, `/uang/aset`, `/jasa`). Tidak ada state bisnis.
- `src/data/DataContext.tsx`: satu `onSnapshot` per koleksi untuk seluruh aplikasi (lewat `repo.watch`). Dokumen dinormalisasi oleh `domain/records.ts` (field hilang diisi nilai kosong). `useLookup()` (satu context) memberi nama klien/jasa/proyek dari id dan `ClientView` per klien.
- Penulisan tidak di-`await` sampai server menjawab (offline persistence): panel langsung tertutup, error ditampilkan lewat toast.
- Panel edit = `?c=<koleksi>&edit=<id>` (atau `edit=baru`, plus `clientId`/`projectId` untuk isian awal) di URL; dirender `features/panels/PanelHost.tsx` di halaman mana pun lewat `openEdit(koleksi, id, prefill)`. Membuka panel menambah entri history, jadi Back menutupnya. Konfigurasi form per koleksi di `features/panels/forms.tsx`; aksi cepat (ganti tahap, sudah dihubungi, lunas, perpanjang, tagihan langganan) di `features/panels/useActions.ts`. Tulis banyak dokumen sekaligus lewat `repo.batch()`.
- Komponen inti dari pustaka ringan, diberi gaya sendiri (text-base, token warna, mode gelap): `Drawer` dan `ConfirmDialog` (`useConfirm()`) di atas Radix Dialog/AlertDialog, `Select` di atas Radix Select (value "" dipetakan ke sentinel), `DatePicker` = Radix Popover + react-day-picker (locale id, minggu mulai Senin, gaya hari di `.cal-day` index.css), `useToast()` = sonner lewat `toast.custom`. Aksi berbahaya (hapus, keluar, buang perubahan) wajib lewat `useConfirm()`. Lint menolak `<select>`, `type="date"`, dan `confirm()` bawaan.
- Mode gelap mengikuti sistem lewat token di `src/index.css`; pakai `bg-surface`/`text-surface`, bukan putih tetap (dijaga lint).
- Daftar Klien, Uang (tagihan, aset), dan Jasa memakai `features/shared/CollectionPage.tsx` (kolom, kartu HP, filter chip, CSV; tanpa form). Detail klien (`features/clients/ClientDetailPage.tsx`) menggabungkan proyek, tagihan, aset, dan riwayat. Form generik di `features/shared/formModel.ts` (murni, dites): field punya `section`, `half`, `dynamic` (label/pilihan/sembunyi bergantung isian lain), dan kind `choice` (chip), `multi`, `toggle`, `pricelist`.
- Halaman Hari ini: `src/lib/summary.ts` (murni, dites; `WINDOW` berisi jendela hari per kelompok). Alur proyek (cap tanggal deal/live, tagihan DP saat deal) di `domain/projectFlow.ts`, harga dari jasa di `domain/pricing.ts`, tagihan langganan bulanan di `domain/billing.ts` (id `<projectId>-<YYYY-MM>`, anti dobel). Semua murni dan dites.
- Modul yang diimpor `scripts/migrate-v2.mjs` (`domain/migrateV1.ts` dan import-nya) memakai ekstensi `.ts` di import dan hanya sintaks TypeScript yang bisa dihapus (tanpa enum), supaya jalan di Node tanpa build.
