import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { inputClass } from "./Field";
import { Popover } from "./Popover";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Dropdown pengganti <select> (pola "select-only combobox" WAI-ARIA). Fokus
 * tetap di tombol pemicu; pilihan aktif ditandai aria-activedescendant.
 * Keyboard: panah, Home/End, Enter/Spasi, Escape, dan ketik huruf awal.
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
  const auto = useId();
  const listId = `${id ?? auto}-list`;
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef({ text: "", at: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const show = (index = Math.max(0, selectedIndex)) => {
    setActive(index);
    setOpen(true);
  };
  const choose = (index: number) => {
    const o = options[index];
    if (o && o.value !== value) onChange(o.value);
    setOpen(false);
  };

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(last);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        return;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        {...aria}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(inputClass, "flex items-center justify-between gap-2 text-left", className)}
      >
        <span className={cn("truncate", !selected && "text-gray-400")}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={20}
          aria-hidden
          className={cn("shrink-0 text-gray-500 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <Popover anchor={trigger} onClose={() => setOpen(false)} matchWidth minWidth={200}>
          <ul ref={list} id={listId} role="listbox" aria-labelledby={id} className="py-1">
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                onPointerDown={(e) => e.preventDefault()}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2",
                  i === active && "bg-gray-100",
                  o.value === value && "font-semibold text-accent",
                )}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={18} aria-hidden className="shrink-0" />}
              </li>
            ))}
          </ul>
        </Popover>
      )}
    </>
  );
}
