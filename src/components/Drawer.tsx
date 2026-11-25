import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cycleTab } from "./Popover";

/**
 * Panel edit: drawer kanan di desktop, sheet penuh di HP. Overlay tetap,
 * jadi halaman di belakangnya tidak berpindah atau di-scroll. Fokus pindah ke
 * panel dengan preventScroll dan Tab berputar di dalamnya. Masuk dengan
 * animasi geser (transform saja, 180ms; mati bila prefers-reduced-motion).
 * Tutup dengan tombol, Escape, atau Back.
 */
export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      // Hanya bila fokus di panel; popover (portal) mengatur Tab-nya sendiri.
      if (e.key === "Tab" && panel.current?.contains(document.activeElement)) cycleTab(e, panel.current);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 animate-fade-in bg-black/50 motion-reduce:animate-none" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute inset-0 flex animate-sheet-in flex-col bg-surface outline-none motion-reduce:animate-none sm:inset-y-0 sm:left-auto sm:w-[480px] sm:animate-drawer-in sm:border-l sm:border-gray-200"
      >
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-3">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-card text-gray-600 hover:bg-gray-100"
          >
            <X size={22} aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && (
          <footer
            className="border-t border-gray-200 px-5 py-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
