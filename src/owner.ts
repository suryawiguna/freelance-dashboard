/**
 * UID akun Google pemilik. Harus sama dengan UID di firestore.rules
 * (`npm run lint` memeriksanya). Rules yang menjaga data; nilai ini hanya
 * dipakai aplikasi untuk langsung menolak akun lain dengan pesan yang jelas,
 * dan untuk tombol masuk di emulator. UID bukan rahasia.
 */
export const OWNER_UID = "OWNER_UID_BELUM_DIISI";
