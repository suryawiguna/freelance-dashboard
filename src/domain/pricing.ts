/**
 * Harga dari jasa (docs/PLAN-KLIEN.md §3). Proyek menyimpan salinan hasilnya,
 * jadi harga patokan yang berubah tidak mengubah deal lama.
 */
import type { Service } from "./types.ts";

export interface Quote {
  price: number | null;
  monthly: number | null;
}

/** Tambahan yang dipilih dan masih ada di jasa. Nama yang sudah dihapus dari jasa diabaikan. */
function extrasTotal(service: Service, chosen: readonly string[]): number {
  return service.extras.filter((x) => chosen.includes(x.name)).reduce((a, x) => a + x.price, 0);
}

/**
 * Harga patokan: setup + tambahan yang dipilih, dan biaya bulanan x jumlah
 * unit bila jasa punya satuan (kasir: per cabang). Tanpa jasa = kosong.
 */
export function quote(service: Service | undefined, chosen: readonly string[], qty: number | null): Quote {
  if (!service) return { price: null, monthly: null };
  const extras = extrasTotal(service, chosen);
  const price = service.setup === null && extras === 0 ? null : (service.setup ?? 0) + extras;
  const monthly = service.monthly === null ? null : service.monthly * (service.unit ? (qty ?? 1) : 1);
  return { price, monthly };
}
