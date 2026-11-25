import * as RS from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { inputClass } from "./Field";

export interface SelectOption {
  value: string;
  label: string;
}

/** Radix Select tidak mengizinkan value "", padahal "" berarti kosong di data kita. */
const EMPTY = "__kosong__";
const toItem = (v: string) => (v === "" ? EMPTY : v);
const fromItem = (v: string) => (v === EMPTY ? "" : v);

/**
 * Dropdown di atas Radix Select (keyboard, ketik huruf awal, aria, layer di
 * atas drawer). Tampilan mengikuti input lain: 16px, tinggi 44px.
 */
export function Select({
  value,
  onChange,
  options,
  id,
  className,
  placeholder = "Pilih",
  ...aria
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  id?: string;
  className?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  return (
    <RS.Root value={toItem(value)} onValueChange={(v) => onChange(fromItem(v))}>
      <RS.Trigger
        id={id}
        {...aria}
        className={cn(
          inputClass,
          "group flex items-center justify-between gap-2 text-left data-[placeholder]:text-gray-400",
          className,
        )}
      >
        <span className="truncate">
          <RS.Value placeholder={placeholder} />
        </span>
        <RS.Icon>
          <ChevronDown
            size={20}
            aria-hidden
            className="shrink-0 text-gray-500 transition-transform group-data-[state=open]:rotate-180"
          />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] min-w-48 animate-pop-in overflow-hidden rounded-card border border-gray-200 bg-surface shadow-lg motion-reduce:animate-none"
        >
          <RS.Viewport className="py-1">
            {options.map((o) => (
              <RS.Item
                key={o.value}
                value={toItem(o.value)}
                className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 px-3 py-2 outline-none data-[highlighted]:bg-gray-100 data-[state=checked]:font-semibold data-[state=checked]:text-accent"
              >
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator>
                  <Check size={18} aria-hidden />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
