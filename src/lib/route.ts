import { useSyncExternalStore } from "react";

/**
 * Router kecil di atas History API. Firebase Hosting me-rewrite semua path ke
 * index.html, jadi /lead dsb. bisa dibuka langsung.
 *
 * Panel edit = `?edit=<id>` (atau `?edit=baru`). Membuka panel menambah satu
 * entri history, jadi tombol Back (juga gesture back di HP) menutupnya tanpa
 * meninggalkan halaman. Menutup lewat tombol atau Escape memanggil
 * history.back() bila entri itu milik kita.
 */
export const ROUTES = [
  { path: "/", label: "Ringkasan" },
  { path: "/lead", label: "Lead" },
  { path: "/proyek", label: "Proyek" },
  { path: "/tagihan", label: "Tagihan" },
  { path: "/aset", label: "Aset" },
] as const;

export type RoutePath = (typeof ROUTES)[number]["path"];

export const NEW_ID = "baru";

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};

const pathSnapshot = (): RoutePath => {
  const p = window.location.pathname.replace(/\/+$/, "") || "/";
  return (ROUTES.find((r) => r.path === p)?.path ?? "/") as RoutePath;
};
const editSnapshot = () => new URLSearchParams(window.location.search).get("edit");

export function useRoute(): RoutePath {
  return useSyncExternalStore(subscribe, pathSnapshot);
}

/** Id yang sedang diedit, NEW_ID untuk tambah baru, atau null bila panel tertutup. */
export function useEditId(): string | null {
  return useSyncExternalStore(subscribe, editSnapshot);
}

const notify = () => window.dispatchEvent(new PopStateEvent("popstate"));

export function navigate(path: RoutePath) {
  if (window.location.pathname === path && !window.location.search) return;
  window.history.pushState(null, "", path);
  window.scrollTo(0, 0);
  notify();
}

/** Buka panel edit, bisa di halaman lain (mis. dari Ringkasan). */
export function openEdit(id: string, path: RoutePath = pathSnapshot()) {
  const url = `${path}?edit=${encodeURIComponent(id)}`;
  if (path === pathSnapshot() && editSnapshot() !== null) {
    window.history.replaceState({ panel: true }, "", url);
  } else {
    window.history.pushState({ panel: true }, "", url);
  }
  notify();
}

export function closeEdit() {
  if ((window.history.state as { panel?: boolean } | null)?.panel) {
    window.history.back();
  } else {
    window.history.replaceState(null, "", window.location.pathname);
    notify();
  }
}
