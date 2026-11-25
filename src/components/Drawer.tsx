import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";

/**
 * Panel edit di atas Radix Dialog (focus trap, Escape, scroll lock, aria).
 * Desktop: drawer kanan. HP: sheet penuh. Fokus awal ke panel itu sendiri
 * tanpa scroll (PLAN §6.2: jangan scroll otomatis). Back juga menutup karena
 * panel terikat ke URL (?edit=...).
 */
export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  /** Dipanggil saat pengguna minta menutup (X, Escape, klik latar). */
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 animate-fade-in bg-black/50 motion-reduce:animate-none" />
        <Dialog.Content
          ref={content}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            content.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            previous.current?.focus({ preventScroll: true });
          }}
          className="fixed inset-0 z-30 flex animate-sheet-in flex-col bg-surface outline-none motion-reduce:animate-none sm:left-auto sm:w-[480px] sm:animate-drawer-in sm:border-l sm:border-gray-200"
        >
          <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-3">
            <Dialog.Title className="truncate text-lg font-bold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Tutup"
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-card text-gray-600 hover:bg-gray-100"
            >
              <X size={22} aria-hidden />
            </Dialog.Close>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
