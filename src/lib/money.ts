/** Uang selalu integer rupiah. Tampilan: "Rp1.400.000". */

const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}Rp${fmt.format(Math.abs(Math.round(amount)))}`;
}

/** Seperti formatRupiah, tetapi null jadi "" (untuk sel kosong). */
export function formatRupiahOrEmpty(amount: number | null | undefined): string {
  return amount == null ? "" : formatRupiah(amount);
}

/**
 * Input pengguna jadi integer rupiah. Menerima "1.400.000", "Rp1.400.000",
 * "1400000", "1 400 000". Kosong = null. Selain itu (desimal, minus, huruf)
 * = undefined supaya form bisa menandai input tidak valid.
 */
export function parseRupiah(input: string): number | null | undefined {
  const s = input.trim().replace(/^rp\s*/i, "").replace(/[.\s]/g, "");
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : undefined;
}
