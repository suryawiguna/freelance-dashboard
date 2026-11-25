import { X } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
import { cn } from "../lib/cn";
import { useMediaQuery } from "../lib/useMediaQuery";

type Kind = "info" | "error";

/**
 * Toast di atas sonner (antrian, animasi, swipe, jeda saat hover). Isinya
 * dirender sendiri lewat toast.custom supaya teks 16px, tombol tutup 44px,
 * dan warna ikut tema. Di HP di bawah (di atas tab bar), di desktop di atas.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const desktop = useMediaQuery("(min-width: 640px)");
  return (
    <>
      {children}
      <Toaster
        position={desktop ? "top-center" : "bottom-center"}
        visibleToasts={3}
        offset={24}
        mobileOffset={{ bottom: "calc(104px + env(safe-area-inset-bottom))", left: 16, right: 16 }}
        style={{ fontFamily: "inherit" }}
      />
    </>
  );
}

function ToastCard({ id, text, kind }: { id: string | number; text: string; kind: Kind }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "flex w-full items-center gap-2 rounded-card py-1 pl-4 pr-1 shadow-lg sm:w-[360px]",
        kind === "error" ? "bg-late text-surface" : "bg-gray-900 text-surface",
      )}
    >
      <span className="flex-1 py-2">{text}</span>
      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        aria-label="Tutup pesan"
        className="flex size-11 shrink-0 items-center justify-center rounded-card opacity-80 hover:opacity-100"
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}

/** `const show = useToast(); show("Tersimpan."); show("Gagal.", "error");` */
export function useToast() {
  return useCallback((text: string, kind: Kind = "info") => {
    toast.custom((id) => <ToastCard id={id} text={text} kind={kind} />, { duration: kind === "error" ? 6000 : 3000 });
  }, []);
}
