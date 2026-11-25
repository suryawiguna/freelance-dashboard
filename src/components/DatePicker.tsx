import * as Popover from "@radix-ui/react-popover";
import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { id as localeId } from "react-day-picker/locale";
import type { DateStr } from "../domain/types";
import { cn } from "../lib/cn";
import { formatDate, isDateStr, todayWita } from "../lib/dates";
import { inputClass } from "./Field";

const pad = (n: number) => String(n).padStart(2, "0");
/** "YYYY-MM-DD" ke Date tengah malam lokal (hanya untuk tampilan kalender). */
const toDate = (s: DateStr) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fromDate = (d: Date): DateStr => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Pemilih tanggal: Radix Popover + react-day-picker (keyboard, aria, locale
 * Indonesia, minggu mulai Senin). Nilai tetap "YYYY-MM-DD" atau "";
 * tampilan "27 Nov 2026"; "hari ini" = WITA. Gaya hari ada di index.css
 * (.cal-day).
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Pilih tanggal",
  ...aria
}: {
  value: DateStr;
  onChange: (value: DateStr) => void;
  id?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const valid = isDateStr(value);
  const today = todayWita();

  const pick = (v: DateStr) => {
    onChange(v);
    setOpen(false);
  };

  const navButton =
    "flex size-11 items-center justify-center rounded-card text-gray-700 hover:bg-gray-100 aria-disabled:opacity-40";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          {...aria}
          className={cn(inputClass, "flex items-center justify-between gap-2 text-left")}
        >
          <span className={cn(!valid && "text-gray-400")}>{valid ? formatDate(value) : placeholder}</span>
          <CalendarDays size={20} aria-hidden className="shrink-0 text-gray-500" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          ref={content}
          // Fokus ke satu-satunya hari yang bisa di-Tab (terpilih, atau hari ini),
          // supaya panah dan Enter langsung bekerja.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            content.current
              ?.querySelector<HTMLButtonElement>('td[data-day] button[tabindex="0"]')
              ?.focus({ preventScroll: true });
          }}
          className="z-50 max-h-[var(--radix-popover-content-available-height)] animate-pop-in overflow-y-auto rounded-card border border-gray-200 bg-surface p-3 shadow-lg outline-none motion-reduce:animate-none"
        >
          <DayPicker
            mode="single"
            required
            showOutsideDays
            fixedWeeks
            locale={localeId}
            weekStartsOn={1}
            today={toDate(today)}
            selected={valid ? toDate(value) : undefined}
            defaultMonth={toDate(valid ? value : today)}
            onSelect={(d) => d && pick(fromDate(d))}
            classNames={{
              root: "text-gray-900",
              months: "relative",
              month: "space-y-1",
              month_caption: "flex h-11 items-center justify-center px-12 font-semibold capitalize",
              nav: "absolute inset-x-0 top-0 flex justify-between",
              button_previous: navButton,
              button_next: navButton,
              chevron: "size-5 fill-current",
              month_grid: "border-collapse",
              weekday: "h-9 w-11 font-normal text-gray-500",
              day: "cal-day p-0 text-center",
              day_button:
                "flex size-11 items-center justify-center rounded-card tabular-nums transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-accent",
            }}
          />
          <div className="mt-2 flex justify-between gap-2 border-t border-gray-200 pt-2">
            <button type="button" onClick={() => pick("")} className="min-h-11 rounded-card px-3 text-gray-600 hover:bg-gray-100">
              Kosongkan
            </button>
            <button
              type="button"
              onClick={() => pick(today)}
              className="min-h-11 rounded-card px-3 font-semibold text-accent hover:bg-accent-soft"
            >
              Hari ini
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
