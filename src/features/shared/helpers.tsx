import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { formatRupiah } from "../../lib/money";
import { cn } from "../../lib/cn";

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
