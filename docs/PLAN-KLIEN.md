# Rencana v2: struktur berpusat pada klien

Status: **rencana, belum dikerjakan** (ditulis 26 Nov 2026). Setelah selesai dibangun, dokumen ini menggantikan bagian model data, halaman, dan ringkasan di [PLAN.md](PLAN.md). Hal lain di PLAN.md tetap berlaku: auth, keamanan, desain, stack, dan aturan kode.

## 1. Tujuan

Satu pertanyaan harus bisa dijawab dalam satu layar: **klien ini bagaimana?**

- Statusnya sekarang apa
- Dapat dari mana
- Harga yang deal berapa
- Proyeknya apa
- Sudah bayar berapa, masih kurang berapa
- Langkah berikutnya apa, dan kapan

Ada dua syarat:

- **Tetap sederhana.** Satu orang, sedikit isian, sedikit halaman.
- **Semua terhubung.** Tidak ada data yang diketik dua kali. Kalau nama klien diganti, semua halaman ikut berubah.

## 2. Prinsip (dari praktik umum alat freelance dan CRM)

1. **Klien jadi pusat.** Struktur Klien → Proyek → Tagihan dan Aset. Calon klien dan klien aktif adalah record yang sama, hanya beda tahap. Tidak ada lagi "lead" yang disalin menjadi "proyek".
2. **Satu proyek, satu perjalanan.** Satu record proyek berjalan dari DM pertama sampai live dan berlangganan. Tahap penjualan dan tahap pengerjaan ada di satu daftar tahap yang sama. Model ini sama dengan Person + Deal di CRM penjualan.
3. **Setiap proyek yang belum tutup wajib punya langkah berikutnya dan tanggalnya.** Termasuk yang On hold, supaya proyek itu muncul lagi pada waktunya. Proyek tanpa tanggal berarti proyek yang terlupakan.
4. **Yang bisa dihitung, dihitung. Tidak disimpan.** Status klien, terakhir dihubungi, total dibayar, dan pendapatan bulanan semuanya dihitung dari data lain. Dengan begitu data selalu sinkron.
5. **Harga dan nominal disimpan sebagai salinan.** Proyek menyimpan harga deal-nya sendiri, dan tagihan menyimpan nominalnya sendiri. Kalau harga patokan jasa naik, deal lama tidak ikut berubah.
6. **Daftar jasa jadi patokan harga.** Harga di proyek terisi otomatis dari jasa, lalu boleh diubah untuk diskon atau tambahan.
7. **Halaman utama menjawab tiga pertanyaan:** siapa yang dihubungi, apa yang dikerjakan, siapa yang ditagih.

Sengaja tidak dikerjakan (sama seperti v1, ditambah beberapa): pelacakan waktu, pembuat proposal atau kontrak, pembuat invoice (tetap pakai Google Sheets), tag, isian kustom, otomasi, integrasi chat atau email, notifikasi push.

## 3. Model data

Uang tetap **integer rupiah**. Tanggal tetap `YYYY-MM-DD` (WITA) atau `""`. Semua dokumen punya `createdAt` dan `updatedAt` (server timestamp). Relasi memakai id, **tidak ada nama yang diduplikasi**. Nama klien selalu diambil dari dokumen `clients`. DataContext sudah memuat semua koleksi di memori, jadi pencariannya murah.

```
services ─┐
          ▼
clients ──► projects ──► payments
   │            │
   └──► assets ◄┘ (projectId opsional)
```

### `clients/{id}`: siapa dan dari mana

| Field | Tipe | Catatan |
|---|---|---|
| name | string | wajib. Nama usaha, atau nama orang bila belum tahu |
| contact | string | link DM (https) atau `mailto:` atau `""`. Tombol "Buka DM" |
| phone | string | nomor WA, opsional. Tombol "Chat WA" ke `https://wa.me/<nomor>` |
| source | enum | Threads, Instagram, WhatsApp, Email, Referral, Website, Lainnya, atau `""` |
| sourceNote | string | detail sumber: dari siapa (referral), postingan mana |
| note | string | catatan bebas tentang klien (jenis usaha, lokasi cabang, dll) |
| log | array | riwayat interaksi, `{ date, text }`, terbaru di depan, maksimal 200 |

Yang **dihitung**, tidak disimpan:

- **Status klien**: tahap proyek paling maju yang belum tutup. Kalau semua proyeknya sudah tutup, statusnya "Selesai" atau "Batal".
- **Terakhir dihubungi**: tanggal terbaru di `log`.
- **Total deal, sudah dibayar, belum dibayar**: dari `projects` dan `payments` milik klien.

### `services/{id}`: jasa dan harga patokan

| Field | Tipe | Catatan |
|---|---|---|
| name | string | wajib. Contoh: "Kasir", "Website" |
| setup | int \| null | harga patokan setup atau proyek |
| setupNote | string | contoh: "mulai dari, tergantung fitur" |
| monthly | int \| null | biaya bulanan patokan |
| unit | string | satuan pengali biaya bulanan, contoh: "cabang". `""` = tanpa pengali |
| dpPercent | int | persen DP saat deal, 0 sampai 100. 100 = bayar penuh di depan, 0 = tanpa DP |
| extras | array | tambahan opsional, `{ name, price }`, maksimal 20 |
| includes | string | yang termasuk dalam paket, untuk bahan penawaran |
| active | bool | jasa yang tidak aktif disembunyikan dari pilihan |

Data awal (silakan dilengkapi):

| Jasa | Setup | Bulanan | Tambahan |
|---|---|---|---|
| Kasir | Rp1.400.000 | Rp145.000 per cabang | |
| Website | mulai Rp4.500.000 | | Booking via WhatsApp +Rp300.000 (jadi penawaran website tour Rp4.800.000) |
| Upgrade WordPress | belum ditentukan | | |

Konstanta `KASIR_MONTHLY_PER_BRANCH` di `records.ts` dihapus dan diganti data jasa.

### `projects/{id}`: apa yang dibeli, dari penawaran sampai live

Menggantikan koleksi `leads` dan `projects` versi lama.

| Field | Tipe | Catatan |
|---|---|---|
| clientId | string | wajib, harus ada di `clients` |
| serviceId | string \| null | jasa yang menjadi patokan |
| name | string | contoh: "Kasir 2 cabang", "Website tour + booking WA". Bila kosong, pakai nama jasa |
| stage | enum | lihat tabel tahap di bawah |
| price | int \| null | harga penawaran, lalu menjadi harga deal setelah Deal. Terisi otomatis dari jasa dan tambahan |
| extras | array of string | nama tambahan yang dipilih (salinan) |
| qty | int \| null | jumlah unit, contoh jumlah cabang |
| monthly | int \| null | biaya bulanan deal. Terisi otomatis dari `services.monthly × qty` |
| next | string | langkah berikutnya |
| nextDate | date | **wajib** selama proyek belum Selesai atau Batal |
| due | date \| "" | deadline pengerjaan |
| link | string | link proyek atau demo (https). Link DM tetap di klien |
| dealAt | date \| "" | diisi otomatis saat tahap menjadi Deal |
| liveAt | date \| "" | diisi otomatis saat tahap menjadi Live. Patokan tanggal tagihan langganan |
| note | string | |

**Tahap** (satu enum, dikelompokkan per fase untuk filter):

| Fase | Tahap | Arti |
|---|---|---|
| Prospek | Baru, Menunggu kabar, Kirim harga, Demo, Nego | masih dikejar |
| Dikerjakan | Deal, Dikerjakan, Revisi | sudah sepakat, sedang dibuat |
| Live | Live | sudah jalan. Bila `monthly` terisi, berarti berlangganan |
| Tutup | Selesai, On hold, Batal | On hold tetap punya `nextDate` supaya muncul lagi |

Tahap Maintenance dan Belum mulai dari v1 dilebur: Maintenance menjadi Live, Belum mulai menjadi Deal.

Di form, label harga mengikuti tahap. Sebelum Deal labelnya "Harga penawaran", sesudahnya "Harga deal". Di sampingnya tampil patokan jasa, misalnya "Patokan Rp1.400.000", dan selisihnya bila berbeda.

### `payments/{id}`: tagihan

| Field | Tipe | Catatan |
|---|---|---|
| clientId | string | wajib |
| projectId | string \| null | |
| type | enum | DP, Pelunasan, Setup, Langganan, Lainnya |
| item | string | no. invoice, bulan, dll |
| period | string | `YYYY-MM` khusus Langganan, `""` untuk yang lain. Mencegah tagihan dobel |
| amount | int | wajib, > 0 |
| due | date \| "" | |
| status | enum | Belum, Lunas |
| paidAt | date \| "" | |

### `assets/{id}`: domain, hosting, project Firebase, dll

| Field | Tipe | Catatan |
|---|---|---|
| clientId | string \| null | `null` = milik sendiri, contoh kasir-demo, Worker kasir-media |
| projectId | string \| null | opsional |
| item, kind, provider, cost, renewal, note | | sama seperti v1 |

## 4. Halaman

Navigasi berisi empat halaman: **Hari ini, Klien, Uang, Jasa**. Sidebar di desktop, bottom tab di HP.

### 4.1 Hari ini (`/`)

Empat kelompok. Yang terlambat diberi warna merah dan selalu di atas, yang dekat diberi warna kuning.

| Kelompok | Isi | Jendela |
|---|---|---|
| Hubungi | proyek fase Prospek atau On hold dengan `nextDate` | 3 hari |
| Kerjakan | proyek fase Dikerjakan dengan `nextDate` atau `due` | 7 hari |
| Tagih | tagihan Belum dengan `due` | 7 hari |
| Perpanjang | aset dengan `renewal` | 30 hari |

Aksi cepat di setiap baris:

- Hubungi: "Buka DM", lalu "Sudah dihubungi". Tombol kedua menambah log, menggeser `nextDate` +3 hari, dan menawarkan pindah ke tahap Menunggu kabar.
- Tagih: "Lunas hari ini".
- Perpanjang: "Sudah diperpanjang", yang menggeser `renewal` +1 tahun.

Di awal bulan muncul baris "Tagihan langganan <bulan> belum dibuat (n)" dengan satu tombol untuk membuatnya.

Di bawahnya ada empat angka: Pendapatan bulanan (total `monthly` proyek Live), Piutang (tagihan Belum), Lunas bulan ini, dan Potensi prospek (total `price` fase Prospek).

### 4.2 Klien (`/klien`)

Daftar yang langsung menjawab pertanyaan di §1. Satu baris per klien:

| Klien | Sumber | Proyek | Tahap | Harga | Berikutnya |
|---|---|---|---|---|---|
| Aneka Ayam Manado | Threads | Kasir 2 cabang | Dikerjakan | Rp1.400.000 + Rp290.000/bln | Selesaikan Fase 4, 28 Nov |

Klien dengan lebih dari satu proyek aktif tampil sebagai satu baris dengan proyek utamanya, plus keterangan "+1 proyek". Filter berupa chip fase (Prospek, Dikerjakan, Live, Tutup) dan chip sumber, ditambah pencarian. Di HP, tabel ini menjadi kartu.

**Tambah klien** dibuat dalam satu form: data klien sekaligus proyek pertamanya (jasa, tahap, harga, langkah berikutnya, dan tanggalnya). Lead baru dari DM selesai dicatat dalam satu langkah.

### 4.3 Detail klien (`/klien/<id>`)

Halaman sendiri, bukan drawer, supaya bisa dibuka langsung dan dibagikan ke diri sendiri.

- **Kepala**: nama, status, sumber, tombol Buka DM dan Chat WA, lalu Edit klien.
- **Proyek**: kartu per proyek berisi tahap (chip, bisa diganti langsung), harga deal, biaya bulanan, langkah berikutnya, deadline, dan link. Klik kartu untuk membuka drawer edit proyek.
- **Uang**: total deal, sudah dibayar, belum dibayar, dan daftar tagihan klien ini.
- **Aset**: daftar aset klien ini beserta tanggal perpanjangannya.
- **Riwayat**: log interaksi, dengan isian satu baris "Tambah catatan" (tanggal default hari ini).

Router v1 (`src/lib/route.ts`) belum mendukung segmen dinamis, jadi perlu ditambah dukungan untuk `/klien/:id`. Panel edit tetap `?edit=`.

### 4.4 Uang (`/uang`)

Dua tab: **Tagihan** dan **Aset**.

- Tagihan: filter Belum atau Lunas, urut jatuh tempo, plus tombol "Buat tagihan langganan bulan ini".
- Aset: semua aset, termasuk yang milik sendiri, urut tanggal perpanjangan.

Ekspor CSV tetap ada per tab.

### 4.5 Jasa (`/jasa`)

Daftar jasa dan harga patokannya, diedit lewat drawer. Jasa yang tidak aktif disembunyikan dari pilihan di form proyek, tapi tetap tampil di proyek lama. Halaman ini juga berguna sebagai contekan saat membalas DM.

## 5. Alur utama

1. **DM masuk.** Tambah klien: isi nama, sumber, link DM, dan pilih jasa. Harga terisi otomatis. Isi langkah berikutnya beserta tanggalnya (default besok).
2. **Follow up.** Muncul di Hari ini. Klik Buka DM, lalu Sudah dihubungi. Log bertambah dan tanggal bergeser.
3. **Kirim harga, demo, nego.** Ganti chip tahap di detail klien. Harga boleh diubah, dan patokannya tetap terlihat.
4. **Deal.** Saat tahap diganti ke Deal, `dealAt` terisi dan muncul tawaran membuat tagihan sesuai `dpPercent` jasa. Contoh: DP 50% Rp700.000 dan Pelunasan Rp700.000, atau Setup penuh bila 100%.
5. **Dikerjakan, revisi.** Isi `due`. Proyek muncul di Hari ini mendekati deadline.
6. **Live.** `liveAt` terisi. Bila `monthly` terisi, proyek mulai dihitung di pendapatan bulanan.
7. **Tiap bulan.** Satu tombol membuat tagihan Langganan untuk semua proyek Live yang punya `monthly`. Id dokumennya `<projectId>-<YYYY-MM>`, jadi aman diklik dua kali. Jatuh tempo = tanggal yang sama dengan `liveAt` di bulan itu.
8. **Lunas.** Klik "Lunas hari ini".
9. **Selesai atau Batal.** Klien keluar dari daftar aktif, tapi riwayatnya tetap ada.

## 6. Aturan integritas

- `clientId` di `projects`, `payments`, dan `assets` divalidasi di rules dengan `exists()` ke `clients`. Begitu juga `projectId` dan `serviceId` bila terisi.
- `nextDate` wajib selama `stage` bukan Selesai atau Batal. Ini divalidasi di rules dan di form.
- **Hapus klien** menghapus semua proyek, tagihan, dan aset miliknya dalam satu batch. Dialog konfirmasi menyebutkan jumlah masing-masing.
- **Hapus proyek** juga menawarkan untuk menghapus tagihannya. Kalau tidak, `projectId` di tagihan dikosongkan.
- **Hapus jasa** hanya bisa bila tidak dipakai proyek mana pun. Kalau masih dipakai, jasa cukup dinonaktifkan.
- `log` dan `extras` dibatasi ukurannya di rules (200 dan 20). Rules tidak bisa memeriksa isi setiap elemen, jadi validasi elemen dilakukan di `domain/validate.ts`.
- Enum di rules tetap harus sama dengan `src/domain/types.ts`, dan tes tetap mengiterasi enum dari file itu.

## 7. Migrasi dari v1

Script `scripts/migrate-v2.mjs` (firebase-admin) dengan mode `--dry-run` yang mencetak hasil pemetaan tanpa menulis apa pun. Urutannya: emulator dulu, lalu project asli setelah disetujui.

| v1 | v2 |
|---|---|
| `leads/{id}` | `clients/{id}` (name, contact, source, note) + `projects/{id}` (service → name, stage, value → price, monthly, branches → qty, followUp → nextDate, next) |
| `projects/{id}` | digabung ke proyek dari lead dengan nama klien yang sama: status, due, link. Kalau tidak ada lead yang cocok, dibuat klien baru |
| `payments` | `client` → `clientId` berdasarkan nama. `projectId` dipetakan ke id baru |
| `assets` | `client` → `clientId`. "Semua calon klien" dan "Semua klien kasir" menjadi `null` (milik sendiri) |

Pemetaan tahap dan status:

| v1 | v2 |
|---|---|
| Lead Deal tanpa proyek | Deal |
| Lead Tutup | Batal |
| Proyek Belum mulai | Deal |
| Proyek Maintenance | Live |
| Lainnya | nama sama |

Proyek terbuka yang `nextDate`-nya kosong diisi tanggal migrasi, supaya langsung muncul di Hari ini untuk dirapikan. Contohnya Cumeyume, beautybar, dan Aura Bali Tours (On hold).

Contoh hasil dari data seed:

- **Aneka Ayam Manado**: lead Nego + proyek kasir-base Dikerjakan menjadi satu proyek "Kasir 2 cabang", tahap Dikerjakan, harga Rp1.400.000, Rp290.000/bln, qty 2, link kasir-demo.web.app.
- **Freedom Villa Bali (Robert)**: tahap Batal.

Koleksi `leads` dan dokumen v1 di `projects` dihapus setelah hasil migrasi dicek di aplikasi, dengan persetujuan terpisah. `scripts/seed-data.json` diganti dengan bentuk v2.

## 8. Fase kerja

Setiap fase diakhiri dengan `npm run lint`, `npm test`, dan `npm run test:rules` yang hijau. Laporkan hasilnya, lalu tunggu persetujuan sebelum commit, push, atau deploy.

1. **Model dan rules**: `types.ts`, `records.ts`, `validate.ts`, `firestore.rules` v2 beserta tesnya (termasuk `exists()` dan `nextDate` wajib), dan seed v2. Fungsi turunan (status klien, terakhir dihubungi, total uang per klien) masuk ke modul murni `src/lib/clients.ts` dan dites.
2. **Jasa**: halaman `/jasa` dan seed jasa.
3. **Klien**: router `/klien/:id`, daftar klien, form gabungan klien + proyek pertama, detail klien, drawer proyek, log.
4. **Uang**: tagihan dan aset dengan `clientId`, tawaran tagihan saat Deal, tombol tagihan langganan bulanan.
5. **Hari ini**: `summary.ts` v2 beserta tesnya, empat kelompok, aksi cepat.
6. **Migrasi**: `migrate-v2.mjs` dengan dry-run, jalankan di emulator, lalu di project asli.
7. **Bersih-bersih**: hapus halaman dan kode v1, perbarui `PLAN.md` dan `CLAUDE.md`, aturan `scripts/check.mjs` untuk route baru.

## 9. Pertanyaan terbuka

- Kasir: biaya setup dibayar penuh di depan, atau DP 50%? Ini menentukan `dpPercent`.
- Tagihan langganan jatuh tempo di tanggal yang sama dengan tanggal live, atau tanggal tetap setiap bulan (misalnya tanggal 1)?
- Website: Rp4.500.000 sudah termasuk apa saja (jumlah halaman, domain, hosting tahun pertama)? Apakah ada biaya bulanan atau tahunan untuk maintenance?
- Jasa lain apa saja yang perlu dicatat beserta harganya?
- Apakah perlu pengingat "sapa klien lama" (klien yang semua proyeknya Selesai dan tidak dihubungi lebih dari 90 hari)? Saran: tunda dulu, tambah setelah v2 dipakai beberapa bulan.
