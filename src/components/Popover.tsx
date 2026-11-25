import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { placePopover, type Placement } from "../lib/position";

/**
 * Dasar dropdown dan kalender. Dirender lewat portal ke body dengan
 * position: fixed, jadi tidak terpotong oleh area scroll di drawer. Posisi
 * dihitung ulang saat scroll/resize (requestAnimationFrame, tanpa layout
 * berulang). Klik di luar dan Escape menutup; Escape tidak sampai ke drawer.
 */
export function Popover({
  anchor,
  onClose,
  children,
  minWidth = 0,
  matchWidth = false,
  className,
  trapFocus = false,
}: {
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  minWidth?: number;
  /** Lebar sama dengan pemicu (dropdown). */
  matchWidth?: boolean;
  className?: string;
  /** Tab berputar di dalam popover (kalender). Dropdown tidak butuh: fokus tetap di pemicu. */
  trapFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<(Placement & { width: number }) | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      const a = anchor.current?.getBoundingClientRect();
      const el = ref.current;
      if (!a || !el) return;
      const width = Math.min(Math.max(matchWidth ? a.width : 0, minWidth), window.innerWidth - 16);
      const p = placePopover(a, { width, height: el.scrollHeight }, { width: window.innerWidth, height: window.innerHeight });
      setPlace((prev) =>
        prev && prev.top === p.top && prev.left === p.left && prev.maxHeight === p.maxHeight && prev.width === width
          ? prev
          : { ...p, width },
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) close.current();
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [anchor, matchWidth, minWidth]);

  const style: CSSProperties = place
    ? { top: place.top, left: place.left, width: place.width, maxHeight: place.maxHeight }
    : { top: 0, left: 0, opacity: 0 }; // bukan visibility: hidden, supaya isi tetap bisa difokus

  return createPortal(
    <div
      ref={ref}
      style={style}
      data-side={place?.side}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close.current();
          anchor.current?.focus({ preventScroll: true });
        }
        if (trapFocus && e.key === "Tab") cycleTab(e, ref.current);
      }}
      className={cn(
        "fixed z-40 overflow-y-auto overscroll-contain rounded-card border border-gray-200 bg-surface shadow-lg",
        "animate-pop-in motion-reduce:animate-none",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Tab dari elemen terakhir kembali ke yang pertama, dan sebaliknya. */
export function cycleTab(e: React.KeyboardEvent | KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
