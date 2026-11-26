import { useMemo, useSyncExternalStore } from "react";
import { COLLECTIONS, type CollectionName } from "../domain/records";

/**
 * Router kecil di atas History API. Firebase Hosting me-rewrite semua path ke
 * index.html, jadi /klien/<id> dsb. bisa dibuka langsung.
 *
 * Panel edit = `?c=<koleksi>&edit=<id>` (atau `edit=baru`), di halaman mana
 * pun: PanelHost di App merendernya. Isian awal untuk data baru ikut di URL
 * (`clientId`, `projectId`). Membuka panel menambah satu entri history, jadi
 * tombol Back (juga gesture back di HP) menutupnya tanpa meninggalkan halaman.
 */
export const NAV = [
  { path: "/", label: "Hari ini" },
  { path: "/klien", label: "Klien" },
  { path: "/uang", label: "Uang" },
  { path: "/jasa", label: "Jasa" },
] as const;

export type NavPath = (typeof NAV)[number]["path"];

export type Page =
  | { name: "today" }
  | { name: "clients" }
  | { name: "client"; id: string }
  | { name: "bills" }
  | { name: "assets" }
  | { name: "services" };

export const NEW_ID = "baru";

export const clientPath = (id: string) => `/klien/${encodeURIComponent(id)}`;

export function matchPath(pathname: string): Page {
  const p = pathname.replace(/\/+$/, "") || "/";
  const client = /^\/klien\/([^/]+)$/.exec(p);
  if (client) return { name: "client", id: decodeURIComponent(client[1]) };
  switch (p) {
    case "/klien":
      return { name: "clients" };
    case "/uang":
      return { name: "bills" };
    case "/uang/aset":
      return { name: "assets" };
    case "/jasa":
      return { name: "services" };
    default:
      return { name: "today" };
  }
}

export function navOf(page: Page): NavPath {
  switch (page.name) {
    case "clients":
    case "client":
      return "/klien";
    case "bills":
    case "assets":
      return "/uang";
    case "services":
      return "/jasa";
    default:
      return "/";
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};
const pathSnapshot = () => window.location.pathname;
const searchSnapshot = () => window.location.search;

export function usePage(): Page {
  const pathname = useSyncExternalStore(subscribe, pathSnapshot);
  return useMemo(() => matchPath(pathname), [pathname]);
}

/** Kunci isian awal yang boleh dibawa lewat URL. */
const PREFILL_KEYS = ["clientId", "projectId"] as const;
export type Prefill = Partial<Record<(typeof PREFILL_KEYS)[number], string>>;

export interface EditTarget {
  collection: CollectionName;
  /** Id dokumen, atau NEW_ID untuk tambah baru. */
  id: string;
  prefill: Prefill;
}

export function parseEdit(search: string): EditTarget | null {
  const q = new URLSearchParams(search);
  const id = q.get("edit");
  const c = q.get("c") as CollectionName | null;
  if (!id || !c || !COLLECTIONS.includes(c)) return null;
  const prefill: Prefill = {};
  for (const k of PREFILL_KEYS) {
    const v = q.get(k);
    if (v) prefill[k] = v;
  }
  return { collection: c, id, prefill };
}

export function useEditTarget(): EditTarget | null {
  const search = useSyncExternalStore(subscribe, searchSnapshot);
  return useMemo(() => parseEdit(search), [search]);
}

const notify = () => window.dispatchEvent(new PopStateEvent("popstate"));

export function navigate(path: string) {
  if (window.location.pathname === path && !window.location.search) return;
  window.history.pushState(null, "", path);
  window.scrollTo(0, 0);
  notify();
}

/**
 * Ganti entri history sekarang (mis. panel "Tambah klien") dengan halaman lain,
 * supaya Back tidak membuka panelnya lagi.
 */
export function replaceWith(path: string) {
  window.history.replaceState(null, "", path);
  window.scrollTo(0, 0);
  notify();
}

/** Link internal: klik biasa pindah halaman tanpa reload, Cmd/Ctrl+klik tetap tab baru. */
export function onNavClick(path: string) {
  return (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(path);
  };
}

/** Buka panel edit di halaman sekarang. Panel yang sudah terbuka diganti, bukan ditumpuk di history. */
export function openEdit(collection: CollectionName, id: string, prefill: Prefill = {}) {
  const q = new URLSearchParams({ c: collection, edit: id });
  for (const [k, v] of Object.entries(prefill)) if (v) q.set(k, v);
  const url = `${window.location.pathname}?${q.toString()}`;
  if (parseEdit(window.location.search) !== null) window.history.replaceState({ panel: true }, "", url);
  else window.history.pushState({ panel: true }, "", url);
  notify();
}

/** Tutup panel lalu pindah halaman (tombol "Lihat klien" di panel). */
export function closeEditAndGo(path: string) {
  if ((window.history.state as { panel?: boolean } | null)?.panel) {
    window.addEventListener("popstate", () => navigate(path), { once: true });
    window.history.back();
  } else {
    replaceWith(path);
  }
}

export function closeEdit() {
  if ((window.history.state as { panel?: boolean } | null)?.panel) {
    window.history.back();
  } else {
    window.history.replaceState(null, "", window.location.pathname);
    notify();
  }
}
