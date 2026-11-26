import { cn } from "../lib/cn";

/** Chip filter. Tap target 44px. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  label: string;
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  /** Di dalam form: id label Field, menggantikan aria-label. */
  labelledBy?: string;
  describedBy?: string;
}) {
  return (
    <div
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="flex flex-wrap gap-2"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-full border px-4 transition-colors",
              active
                ? "border-accent bg-accent-soft font-semibold text-accent"
                : "border-gray-200 bg-surface text-gray-700 hover:bg-gray-50",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1.5 text-gray-500">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Beberapa chip yang bisa aktif sekaligus (tambahan di proyek). */
export function ChipToggleGroup({
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onChange: (v: string[]) => void;
  labelledBy?: string;
  describedBy?: string;
}) {
  if (options.length === 0) return <p className="text-gray-500">Tidak ada pilihan.</p>;
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "min-h-11 rounded-full border px-4 transition-colors",
              active
                ? "border-accent bg-accent-soft font-semibold text-accent"
                : "border-gray-200 bg-surface text-gray-700 hover:bg-gray-50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type Tone = "ok" | "near" | "late" | "neutral" | "accent";

const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  near: "bg-near-soft text-near",
  late: "bg-late-soft text-late",
  neutral: "bg-gray-100 text-gray-700",
  accent: "bg-accent-soft text-accent",
};

/** Label status kecil (tetap 16px). Selalu berisi teks, warna hanya pendukung. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 font-semibold", TONES[tone])}>
      {children}
    </span>
  );
}
