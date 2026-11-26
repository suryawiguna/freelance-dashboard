import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "neutral" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-surface hover:bg-accent-hover",
  neutral: "border border-gray-200 bg-surface text-gray-900 hover:bg-gray-50",
  ghost: "text-gray-700 hover:bg-gray-100",
  danger: "bg-late text-surface hover:opacity-90",
};

/** Tap target minimal 44px (PLAN §7). `icon` = tombol persegi 44px berisi ikon saja (wajib aria-label). */
export function Button({
  variant = "neutral",
  icon = false,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; icon?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-card font-semibold transition-colors",
        icon ? "w-11 shrink-0" : "px-4",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
