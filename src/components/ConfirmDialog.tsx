import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  /** Label tombol setuju, mis. "Ya, hapus". */
  confirmLabel: string;
  /** "danger" (merah) untuk yang tidak bisa dibatalkan. */
  tone?: "danger" | "primary";
}

type Ask = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask>(() => Promise.resolve(false));

/**
 * Dialog konfirmasi untuk aksi berbahaya (keluar, hapus, buang perubahan),
 * di atas Radix AlertDialog: fokus awal di "Batal", Escape = batal, klik di
 * luar tidak menutup, Tab terkunci di dialog.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const ask = useCallback<Ask>((opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })), []);

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const button =
    "inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-card px-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <AlertDialog.Root open={pending !== null} onOpenChange={(open) => !open && answer(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/50 motion-reduce:animate-none" />
          <AlertDialog.Content
            className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm animate-pop-in rounded-card border border-gray-200 bg-surface p-6 shadow-lg outline-none motion-reduce:animate-none sm:inset-x-0 sm:bottom-auto sm:top-1/3"
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          >
            <AlertDialog.Title className="text-lg font-bold">{pending?.title}</AlertDialog.Title>
            {pending?.body ? (
              <AlertDialog.Description className="mt-2 text-gray-600">{pending.body}</AlertDialog.Description>
            ) : (
              <AlertDialog.Description className="sr-only">{pending?.title}</AlertDialog.Description>
            )}
            <div className="mt-6 flex gap-2">
              <AlertDialog.Cancel className={cn(button, "border border-gray-200 bg-surface text-gray-900 hover:bg-gray-50")}>
                Batal
              </AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={() => answer(true)}
                className={cn(
                  button,
                  pending?.tone === "danger"
                    ? "bg-late text-surface hover:opacity-90"
                    : "bg-accent text-surface hover:bg-accent-hover",
                )}
              >
                {pending?.confirmLabel}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}

/** `const ask = useConfirm(); if (await ask({...})) ...` */
export const useConfirm = () => useContext(ConfirmContext);
