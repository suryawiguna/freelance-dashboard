import { useId, type ReactNode } from "react";
import { cn } from "../lib/cn";

export const inputClass =
  "block min-h-11 w-full rounded-card border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-accent focus:outline-2 focus:outline-accent/30 aria-[invalid=true]:border-late";

/** Label + input + petunjuk + pesan salah. Semua teks 16px. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const describe = error || hint ? `${id}-desc` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-semibold text-gray-800">
        {label}
        {required && <span className="text-late"> *</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describe })}
      {(error || hint) && (
        <p id={describe} className={cn(error ? "text-late" : "text-gray-500")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
