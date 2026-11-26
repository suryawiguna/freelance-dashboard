import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type Tone } from "../../components/Chip";
import type { Stage } from "../../domain/types";
import { cn } from "../../lib/cn";
import { formatRupiah } from "../../lib/money";
import { onNavClick } from "../../lib/route";

/** Urutkan tanggal naik, kosong di belakang. */
export function byDate(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export const byText = (a: string, b: string) => a.localeCompare(b, "id", { sensitivity: "base" });

export function Money({ value, suffix }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-gray-400">-</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatRupiah(value)}
      {suffix && <span className="text-gray-500">{suffix}</span>}
    </span>
  );
}

export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return <p className={cn("text-gray-500", className)}>{children}</p>;
}

/** Baris "Label: isi" di kartu HP. */
export function CardLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2">
      <span className="text-gray-500">{label}</span>
      <span>{children}</span>
    </p>
  );
}

/** Link keluar sebagai tombol, buka di tab baru. Tap target 44px. */
export function LinkButton({
  href,
  children,
  className,
  iconOnly = false,
}: {
  href: string;
  /** Teks tombol; jadi aria-label dan tooltip bila iconOnly. */
  children: string;
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={iconOnly ? children : undefined}
      title={iconOnly ? children : undefined}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-card border border-gray-200 bg-surface font-semibold text-gray-900 hover:bg-gray-50",
        iconOnly ? "w-11" : "px-4",
        className,
      )}
    >
      <ExternalLink size={18} aria-hidden />
      {!iconOnly && children}
    </a>
  );
}

const STAGE_TONE: Partial<Record<Stage, Tone>> = { Revisi: "near", Live: "ok" };

/** Tahap proyek sebagai label. Netral kecuali Revisi (kuning) dan Live (hijau). */
export function StageBadge({ stage }: { stage: Stage | null }) {
  if (!stage) return <Badge tone="neutral">Belum ada proyek</Badge>;
  return <Badge tone={STAGE_TONE[stage] ?? "neutral"}>{stage}</Badge>;
}

/** Harga proyek: "Rp1.400.000 + Rp290.000/bln". */
export function PriceText({ price, monthly }: { price: number | null; monthly: number | null }) {
  if (price === null && monthly === null) return <span className="text-gray-400">-</span>;
  return (
    <span className="tabular-nums">
      {price !== null && <Money value={price} />}
      {price !== null && monthly !== null && <span className="text-gray-500"> + </span>}
      {monthly !== null && <Money value={monthly} suffix="/bln" />}
    </span>
  );
}

/** Link internal yang tetap bisa dibuka di tab baru. */
export function NavLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a href={to} onClick={onNavClick(to)} className={className}>
      {children}
    </a>
  );
}
