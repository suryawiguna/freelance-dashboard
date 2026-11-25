# Dashboard Freelance: rencana untuk Claude Code

Dokumen ini adalah brief untuk membangun web dashboard freelance pribadi Surya. Taruh di root repo baru sebagai `docs/PLAN.md`. Buat juga `CLAUDE.md` singkat yang merujuk ke dokumen ini.

## 1. Tujuan

Satu tempat untuk mengelola semua urusan freelance:

- **Pipeline lead**: sebagian besar dari DM Threads. Pantau tahap dan jadwal follow up.
- **Proyek dan klien aktif**: status dan langkah berikutnya.
- **Pendapatan dan tagihan**: DP, pelunasan, setup, dan langganan bulanan kasir.
- **Aset dan langganan**: domain, hosting, project Firebase, dan Cloudflare per klien, beserta tanggal perpanjangan.

Pengguna hanya satu, yaitu Surya. Aplikasi dipakai di laptop dan HP.

## 2. Batasan (sengaja tidak dikerjakan dulu)

- Tidak multi-user dan tidak ada peran.
- Tidak ada integrasi Threads, karena tidak ada API untuk DM. Link DM cukup di-paste manual.
- Tidak membuat invoice. Invoice tetap memakai Google Sheets yang sudah ada. Dashboard hanya mencatat tagihannya.
- Tidak ada notifikasi push atau email di versi pertama.

## 3. Stack

Disamakan dengan repo `kasir` supaya familiar:

- React 19, Vite, TypeScript, Tailwind v4
- Firebase: Auth (Google sign-in), Firestore, Hosting, paket Spark
- `vite-plugin-pwa` agar bisa di-install di HP (opsional, di fase terakhir)
- Vitest untuk modul murni, emulator Firebase untuk tes rules

## 4. Auth dan keamanan

- Login hanya dengan Google. Satu akun diizinkan, yaitu UID Surya.
- Simpan UID pemilik di rules, misalnya `request.auth.uid == "<UID>"`. Bisa juga lewat custom claim `owner: true`.
- Rules dibuat deny-by-default. Semua koleksi hanya bisa dibaca dan ditulis pemilik.
- Field divalidasi di rules: tipe, panjang string, enum untuk tahap/status, dan angka yang tidak negatif.
- Setiap aturan baru wajib punya tes di `tests/rules/`.

## 5. Model data (Firestore)

Semua uang disimpan sebagai **integer rupiah**. Tanggal disimpan sebagai string `YYYY-MM-DD` (tanggal lokal WITA), atau kosong. Setiap dokumen punya `createdAt` dan `updatedAt` (server timestamp).

### `leads/{id}`

| Field | Tipe | Catatan |
|---|---|---|
| name | string | wajib |
| service | string | contoh: "Kasir (2 cabang)", "Website" |
| source | enum | Threads, Instagram, WhatsApp, Referral, Website, Lainnya |
| contact | string url | link DM Threads atau kontak lain; harus https |
| stage | enum | Baru, Kirim harga, Nego, Deal, On hold, Tutup |
| value | int \| null | nilai setup / proyek |
| monthly | int \| null | biaya bulanan (Rp145.000 × jumlah cabang untuk kasir) |
| branches | int \| null | jumlah cabang, opsional; kalau diisi, `monthly` bisa dihitung otomatis |
| followUp | date \| "" | tanggal follow up berikutnya |
| next | string | langkah berikutnya |
| note | string | catatan bebas |

Lead **terbuka** = tahap Baru, Kirim harga, atau Nego.

Saat lead pindah ke tahap Deal, tawarkan tombol "Jadikan proyek" yang membuat dokumen `projects` dengan klien, link, dan biaya bulanan yang sama.

### `projects/{id}`

| Field | Tipe | Catatan |
|---|---|---|
| client | string | wajib |
| leadId | string \| null | asal lead, opsional |
| name | string | nama proyek |
| status | enum | Belum mulai, Dikerjakan, Revisi, Live, Maintenance, Selesai |
| monthly | int \| null | biaya langganan berjalan |
| due | date \| "" | deadline |
| link | string url | link proyek / demo |
| next | string | langkah berikutnya |

### `payments/{id}`

| Field | Tipe | Catatan |
|---|---|---|
| client | string | wajib |
| projectId | string \| null | opsional |
| item | string | no. invoice, bulan, dll |
| type | enum | DP, Pelunasan, Setup, Langganan, Lainnya |
| amount | int | wajib, > 0 |
| due | date \| "" | jatuh tempo |
| status | enum | Belum, Lunas |
| paidAt | date \| "" | tanggal dibayar |

### `assets/{id}`

| Field | Tipe | Catatan |
|---|---|---|
| client | string | wajib |
| item | string | domain, nama project Firebase, dll |
| kind | enum | Domain, Hosting, Firebase, Cloudflare, Lainnya |
| provider | string | |
| cost | int \| null | biaya per tahun |
| renewal | date \| "" | tanggal perpanjangan |
| note | string | |

## 6. Halaman dan fitur

### 6.1 Ringkasan (halaman utama)

Kartu angka:

- **Lead terbuka**: jumlahnya, plus total potensi setup.
- **Pendapatan bulanan**: total `monthly` dari proyek berstatus Live dan Maintenance.
- **Belum dibayar**: total tagihan yang belum Lunas.
- **Lunas bulan ini**: total tagihan Lunas yang `paidAt`-nya jatuh di bulan berjalan.
- **Perpanjangan dekat**: jumlah aset dengan `renewal` dalam 30 hari ke depan.

Di bawahnya ada daftar **Perlu ditindaklanjuti**, diurutkan per tanggal. Yang sudah lewat diberi warna merah, yang dekat diberi warna kuning. Isinya:

- Lead terbuka dengan `followUp` dalam 3 hari ke depan atau yang sudah lewat
- Proyek yang belum Live/Selesai dengan `due` dalam 7 hari ke depan
- Tagihan yang belum Lunas dengan `due` dalam 7 hari ke depan
- Aset dengan `renewal` dalam 30 hari ke depan

Klik satu item untuk membuka detailnya.

### 6.2 Lead, Proyek, Tagihan, Aset

Setiap halaman berisi:

- Daftar dalam bentuk tabel di desktop dan kartu di HP (di bawah 640px). Tabel tidak boleh scroll horizontal di HP.
- Tombol "Tambah".
- Klik baris untuk membuka panel edit. Di desktop panel ini berupa drawer kanan, di HP berupa sheet penuh. **Jangan** scroll otomatis halaman. Tutup dengan tombol, Escape, atau Back.
- Filter sederhana: tahap/status (chip), sumber (khusus lead), dan pencarian nama.
- Hapus memakai konfirmasi dua langkah di dalam panel, bukan `confirm()`.
- Khusus lead: tombol "Buka DM" yang membuka `contact` di tab baru, dan tombol cepat "Follow up +3 hari" yang menggeser `followUp`.

### 6.3 Ekspor

Tombol Ekspor CSV per koleksi.

## 7. Desain

Prinsipnya simple dan clean, dengan banyak ruang kosong.

- **Ukuran font minimum 16px di mana pun**, termasuk label, chip, caption, tabel, input, dan tombol. Skala yang dipakai: 16 (body/caption), 18 (subjudul), 24 (judul halaman), 32 (angka kartu). Jangan ada `text-xs` atau `text-sm`. Set di Tailwind theme supaya ukuran di bawah 16 tidak tersedia.
- Font: Inter atau Nunito, satu keluarga saja. Angka memakai `tabular-nums`.
- Warna netral (putih, abu-abu, hitam) dengan satu warna aksen. Status: hijau = ok, kuning = dekat, merah = lewat. Jangan mengandalkan warna saja; tambahkan teks seperti "Lewat 2 hari".
- Kartu putih, border 1px abu-abu terang, radius 12px, tanpa bayangan berat.
- Tap target minimal 44px.
- Mode gelap mengikuti sistem (opsional).
- Navigasi: sidebar di desktop, bottom tab bar di HP (Ringkasan, Lead, Proyek, Tagihan, Aset).
- Semua teks UI memakai Bahasa Indonesia dengan sentence case. Format uang `Rp1.400.000`, format tanggal `27 Nov 2026`.
- Jangan pakai em dash di teks UI.

## 8. Struktur kode

```
src/
  domain/types.ts        tipe Lead, Project, Payment, Asset + enum
  lib/money.ts           formatRupiah, parse input "1.400.000"
  lib/dates.ts           today WITA, selisih hari, format tanggal
  lib/summary.ts         hitung kartu ringkasan + daftar tindak lanjut (modul murni, dites)
  data/firebase.ts       init
  data/repo.ts           semua akses koleksi lewat sini (list, save, remove)
  features/<koleksi>/    halaman list + form
  components/            Drawer, Table/CardList, Chip, Field, Button, EmptyState
```

Aturan kode:

- Semua akses Firestore lewat `data/repo.ts`.
- Semua angka di ringkasan dihitung di `lib/summary.ts` dan dites dengan Vitest.
- Listener memakai `onSnapshot`. Offline persistence menyala.
- Jangan simpan state bisnis di `App.tsx`.

## 9. Fase kerja

Setiap fase diakhiri dengan `npm run lint`, `npm test`, dan `npm run test:rules` yang hijau. Laporkan hasilnya, lalu tunggu persetujuan sebelum commit/push.

1. **Fondasi**: Vite + TS + Tailwind (skala font min 16px), Firebase init, login Google, rules owner-only beserta tesnya, emulator.
2. **Lead**: tipe, repo, list + form + drawer, filter, Buka DM, Follow up +3 hari.
3. **Proyek, Tagihan, Aset**: halaman list + form, serta "Jadikan proyek" dari lead yang Deal.
4. **Ringkasan**: `summary.ts` + tes, kartu, daftar tindak lanjut.
5. **Polish**: tampilan HP (kartu, bottom nav), ekspor CSV, PWA, deploy ke Firebase Hosting.
6. **Import data awal**: script `scripts/seed.mjs` (firebase-admin) yang mengisi data dari lampiran A. Jalankan sekali saja.

## 10. Kriteria selesai

- Hanya akun Surya yang bisa login dan membaca data. Tes rules membuktikannya.
- Semua teks di layar berukuran minimal 16px. Cek dengan DevTools di 375px dan 1440px.
- Klik baris membuka panel edit tanpa halaman berpindah atau blank.
- Angka ringkasan sesuai dengan data seed: 5 lead terbuka, potensi setup Rp5.600.000.

## Lampiran A: data awal (per 25 Nov 2026)

```json
{
  "leads": [
    { "id": "aneka-ayam", "name": "Aneka Ayam Manado", "service": "Kasir (2 cabang)", "source": "Threads", "contact": "https://www.threads.com/messages/t/1129039183264155", "stage": "Nego", "value": 1400000, "monthly": 290000, "followUp": "", "next": "Siapkan pilot kasir-base", "note": "Ayam segar, cabang Tikala dan Perkamil" },
    { "id": "cumeyume", "name": "Cumeyume", "service": "Kasir", "source": "Threads", "contact": "https://www.threads.com/messages/t/1475145657906984", "stage": "Kirim harga", "value": 1400000, "monthly": 145000, "followUp": "", "next": "Follow up penawaran", "note": "Juga jualan dimsum" },
    { "id": "mini-cafe", "name": "Mini cafe (nama belum diketahui)", "service": "Kasir (2 cabang)", "source": "Threads", "contact": "https://www.threads.com/messages/t/1455741522754265", "stage": "Kirim harga", "value": 1400000, "monthly": 290000, "followUp": "2026-11-27", "next": "Follow up, chat terakhir (harga) masih Seen", "note": "Belum sebut nama usaha" },
    { "id": "dimsum-online", "name": "Dimsum online (nama belum diketahui)", "service": "Kasir", "source": "", "contact": "", "stage": "Kirim harga", "value": 1400000, "monthly": 145000, "followUp": "2026-11-27", "next": "Follow up, chat terakhir (harga) masih Seen", "note": "Jualan dimsum online, belum sebut nama usaha" },
    { "id": "beautybar", "name": "beautybar.cabntb (nail art)", "service": "", "source": "Threads", "contact": "https://www.threads.com/messages/t/1136354828995391", "stage": "Baru", "value": null, "monthly": null, "followUp": "", "next": "", "note": "" },
    { "id": "aura-bali-tours", "name": "Aura Bali Tours", "service": "Website + booking WA", "source": "", "contact": "", "stage": "On hold", "value": 4800000, "monthly": null, "followUp": "", "next": "Tunggu klien siap DP setelah low season", "note": "Domain aurabalitours.com belum dibeli, cek lagi sebelum mulai" },
    { "id": "freedom-villa", "name": "Freedom Villa Bali (Robert)", "service": "Upgrade WordPress", "source": "", "contact": "", "stage": "Tutup", "value": null, "monthly": null, "followUp": "", "next": "", "note": "Tidak ada balasan" }
  ],
  "projects": [
    { "id": "kasir-base", "client": "Aneka Ayam Manado", "name": "kasir-base (pilot)", "status": "Dikerjakan", "monthly": null, "due": "", "link": "https://kasir-demo.web.app", "next": "Selesaikan Fase 4 (Ubah item), lalu deploy dan pilot" }
  ],
  "payments": [],
  "assets": [
    { "id": "kasir-demo", "client": "Semua calon klien", "item": "kasir-demo.web.app", "kind": "Firebase", "provider": "Firebase (Spark)", "cost": 0, "renewal": "", "note": "Satu demo untuk semua calon klien, belum dibagikan ke siapa pun" },
    { "id": "kasir-media", "client": "Semua klien kasir", "item": "Worker kasir-media + R2", "kind": "Cloudflare", "provider": "Cloudflare", "cost": null, "renewal": "", "note": "Satu bucket R2 per klien" }
  ]
}
```
