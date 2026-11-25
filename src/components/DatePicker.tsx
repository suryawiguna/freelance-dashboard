import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DateStr } from "../domain/types";
import {
  addMonths,
  longDate,
  monthGrid,
  monthTitle,
  shiftMonth,
  WEEKDAYS,
  weekdayIndex,
  ymOf,
  type YearMonth,
} from "../lib/calendar";
import { cn } from "../lib/cn";
import { addDays, formatDate, isDateStr, todayWita } from "../lib/dates";
import { inputClass } from "./Field";
import { Popover } from "./Popover";

/**
 * Pemilih tanggal pengganti <input type="date">. Nilai tetap "YYYY-MM-DD"
 * atau "". Tampilan "27 Nov 2026", minggu mulai Senin, hari ini = WITA.
 * Keyboard di kalender: panah (hari/minggu), PageUp/PageDown (bulan),
 * Home/End (awal/akhir minggu), Enter (pilih), Escape (tutup).
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
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const valid = isDateStr(value);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        {...aria}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(inputClass, "flex items-center justify-between gap-2 text-left")}
      >
        <span className={cn(!valid && "text-gray-400")}>{valid ? formatDate(value) : placeholder}</span>
        <CalendarDays size={20} aria-hidden className="shrink-0 text-gray-500" />
      </button>
      {open && (
        <Popover anchor={trigger} onClose={() => setOpen(false)} minWidth={332} trapFocus>
          <Calendar
            value={valid ? value : ""}
            onPick={(d) => {
              onChange(d);
              close();
            }}
          />
        </Popover>
      )}
    </>
  );
}

function Calendar({ value, onPick }: { value: DateStr; onPick: (d: DateStr) => void }) {
  const today = todayWita();
  const [focus, setFocus] = useState<DateStr>(value || today);
  const [view, setView] = useState<YearMonth>(ymOf(value || today));
  const grid = useRef<HTMLDivElement>(null);

  // Fokus ke hari terpilih saat dibuka, lalu ikuti navigasi keyboard.
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus({ preventScroll: true });
  }, [focus, view]);

  const go = (d: DateStr) => {
    setFocus(d);
    const ym = ymOf(d);
    if (ym.year !== view.year || ym.month !== view.month) setView(ym);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, () => DateStr> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, -1),
      PageDown: () => addMonths(focus, 1),
      Home: () => addDays(focus, -weekdayIndex(focus)),
      End: () => addDays(focus, 6 - weekdayIndex(focus)),
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      go(move());
    }
  };

  const changeMonth = (delta: number) => {
    const next = shiftMonth(view, delta);
    setView(next);
    setFocus(addMonths(focus, delta));
  };

  const cells = monthGrid(view);

  return (
    <div role="dialog" aria-label="Pilih tanggal" className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="Bulan sebelumnya"
          className="flex size-11 items-center justify-center rounded-card text-gray-700 hover:bg-gray-100"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
        <p className="font-semibold" aria-live="polite">
          {monthTitle(view)}
        </p>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label="Bulan berikutnya"
          className="flex size-11 items-center justify-center rounded-card text-gray-700 hover:bg-gray-100"
        >
          <ChevronRight size={22} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-gray-500" aria-hidden>
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>

      <div ref={grid} role="grid" className="grid grid-cols-7" onKeyDown={onKeyDown}>
        {cells.map((c) => {
          const selected = c.date === value;
          const isToday = c.date === today;
          return (
            <button
              key={c.date}
              type="button"
              data-date={c.date}
              tabIndex={c.date === focus ? 0 : -1}
              aria-label={`${longDate(c.date)}${isToday ? ", hari ini" : ""}`}
              aria-pressed={selected}
              onClick={() => onPick(c.date)}
              className={cn(
                "flex h-11 items-center justify-center rounded-card tabular-nums transition-colors",
                "focus-visible:outline-2 focus-visible:outline-accent",
                selected
                  ? "bg-accent font-bold text-surface"
                  : cn(
                      "hover:bg-gray-100",
                      c.inMonth ? "text-gray-900" : "text-gray-400",
                      isToday && "font-bold text-accent ring-1 ring-accent ring-inset",
                    ),
              )}
            >
              {c.day}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between gap-2 border-t border-gray-200 pt-2">
        <button
          type="button"
          onClick={() => onPick("")}
          className="min-h-11 rounded-card px-3 text-gray-600 hover:bg-gray-100"
        >
          Kosongkan
        </button>
        <button
          type="button"
          onClick={() => onPick(today)}
          className="min-h-11 rounded-card px-3 font-semibold text-accent hover:bg-accent-soft"
        >
          Hari ini
        </button>
      </div>
    </div>
  );
}
