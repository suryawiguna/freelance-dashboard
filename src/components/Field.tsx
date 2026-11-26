import { useId, type ReactNode } from "react";
import { cn } from "../lib/cn";

export const inputClass =
  "block min-h-11 w-full rounded-card border border-gray-300 bg-surface px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-accent focus:outline-2 focus:outline-accent/30 aria-[invalid=true]:border-late";

/** Label + input + petunjuk + pesan salah. Label punya id `${id}-label` untuk grup chip. */
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
      <label id={`${id}-label`} htmlFor={id} className="block font-medium text-gray-700">
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
