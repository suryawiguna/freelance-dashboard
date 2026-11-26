/** Tombol kontak klien: Buka DM / Kirim email dari `contact`, Chat WA dari `phone`. */

export const contactLabel = (contact: string) => (contact.startsWith("mailto:") ? "Kirim email" : "Buka DM");

/**
 * Link wa.me dari nomor yang diketik bebas ("0812-3456 7890", "+62 812...").
 * Awalan 0 diganti 62 (Indonesia). Nomor terlalu pendek = "".
 */
export function waLink(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return digits.length >= 8 ? `https://wa.me/${digits}` : "";
}
