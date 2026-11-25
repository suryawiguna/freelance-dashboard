import { X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

type Kind = "info" | "error";
interface Toast {
  id: number;
  text: string;
  kind: Kind;
}

const MAX = 3;

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {});

/**
 * Pesan singkat: di bawah (di atas tab bar) di HP, di atas di desktop.
 * Tanpa pustaka. Maksimal tiga sekaligus, yang lama tergeser. Hilang sendiri
 * (3 detik, error 6 detik), berhenti menghitung selama di-hover, dan bisa
 * ditutup dengan tombol X.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const arm = useCallback(
    (id: number, kind: Kind) => {
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3000));
    },
    [dismiss],
  );

  const show = useCallback(
    (text: string, kind: Kind = "info") => {
      const id = ++seq.current;
      setToasts((t) => {
        const next = [...t, { id, text, kind }];
        for (const old of next.slice(0, Math.max(0, next.length - MAX))) clearTimeout(timers.current.get(old.id));
        return next.slice(-MAX);
      });
      arm(id, kind);
    },
    [arm],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:top-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            onPointerEnter={() => clearTimeout(timers.current.get(t.id))}
            onPointerLeave={() => arm(t.id, t.kind)}
            className={cn(
              "pointer-events-auto flex max-w-md animate-toast-in items-center gap-2 rounded-card py-1 pl-4 pr-1 shadow-lg motion-reduce:animate-none",
              t.kind === "error" ? "bg-late text-surface" : "bg-gray-900 text-surface",
            )}
          >
            <span className="flex-1 py-2">{t.text}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Tutup pesan"
              className="flex size-11 shrink-0 items-center justify-center rounded-card opacity-80 hover:opacity-100"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
